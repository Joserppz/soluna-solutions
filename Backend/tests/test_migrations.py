import pytest
from sqlalchemy import text

from scripts.migrate import MIGRATION_PATTERN, available_migrations, migration_engine
from tests.conftest import requires_db


def test_migraciones_numeradas_y_en_orden():
    migrations = available_migrations()
    versions = [version for version, _ in migrations]

    assert versions, "Debe existir al menos la migración 001"
    assert versions == sorted(versions)
    assert all(MIGRATION_PATTERN.match(path.name) for _, path in migrations)


def test_migraciones_usan_migration_database_url(monkeypatch):
    monkeypatch.setenv(
        "MIGRATION_DATABASE_URL", "postgresql://migrador:clave@pooler.ejemplo:5432/postgres"
    )
    engine = migration_engine()

    assert engine.url.port == 5432
    assert engine.url.username == "migrador"
    assert engine.url.drivername == "postgresql+psycopg2"


def test_sin_migration_database_url_usa_la_de_la_api(monkeypatch):
    from app.core.database import engine

    monkeypatch.delenv("MIGRATION_DATABASE_URL", raising=False)

    assert migration_engine() is engine


def test_checksum_ignora_finales_de_linea_de_windows(tmp_path):
    from scripts.migrate import checksum

    unix, windows = tmp_path / "a.sql", tmp_path / "b.sql"
    unix.write_bytes(b"select 1;\nselect 2;\n")
    windows.write_bytes(b"select 1;\r\nselect 2;\r\n")

    assert checksum(unix) == checksum(windows)


@requires_db
def test_migraciones_crean_las_tablas_del_modelo(migrated_engine):
    with migrated_engine.connect() as conn:
        tables = set(
            conn.execute(
                text("select tablename from pg_tables where schemaname = 'public'")
            ).scalars()
        )
        applied = dict(conn.execute(text("select version, checksum from schema_migrations")).all())

    assert {
        "roles",
        "permissions",
        "role_permissions",
        "users",
        "sessions",
        "auth_tokens",
        "rate_limits",
        "audit_logs",
        "patients",
        "patient_contacts",
        "patient_evaluations",
        "patient_documents",
        "schedules",
        "attendance",
        "inventory_items",
        "inventory_movements",
        "donations",
        "donation_goals",
        "donation_goal_milestones",
        "media_albums",
        "media_assets",
        "media_patient_tags",
        "institutional_sections",
        "inquiries",
        "inquiry_notes",
    } <= tables
    assert "001" in applied
    assert len(applied["001"]) == 64


@requires_db
def test_la_migracion_no_crea_usuarios(migrated_engine):
    from scripts.migrate import MIGRATIONS_DIR

    sql = (MIGRATIONS_DIR / "001_base.sql").read_text(encoding="utf-8").lower()

    assert "insert into public.users" not in sql


@requires_db
def test_reaplicar_migraciones_no_hace_nada(migrated_engine):
    from scripts.migrate import apply_migrations

    assert apply_migrations(migrated_engine) == []


@requires_db
def test_migracion_modificada_despues_de_aplicarse_detiene_todo(migrated_engine):
    from scripts.migrate import MigrationError, apply_migrations

    with migrated_engine.begin() as conn:
        original = conn.execute(
            text("select checksum from schema_migrations where version = '001'")
        ).scalar_one()
        conn.execute(text("update schema_migrations set checksum = 'otro' where version = '001'"))
    try:
        with pytest.raises(MigrationError, match="cambió después de aplicarse"):
            apply_migrations(migrated_engine)
    finally:
        with migrated_engine.begin() as conn:
            conn.execute(
                text("update schema_migrations set checksum = :c where version = '001'"),
                {"c": original},
            )


@requires_db
def test_base_con_migraciones_del_sprint_1_pide_reiniciarla(migrated_engine):
    from scripts.migrate import MigrationError, apply_migrations

    with migrated_engine.begin() as conn:
        conn.execute(
            text(
                "update schema_migrations set name = '001_initial_schema.sql' where version = '001'"
            )
        )
    try:
        with pytest.raises(MigrationError, match="docker compose down -v"):
            apply_migrations(migrated_engine)
    finally:
        with migrated_engine.begin() as conn:
            conn.execute(
                text("update schema_migrations set name = '001_base.sql' where version = '001'")
            )


@requires_db
def test_dos_procesos_no_migran_a_la_vez(migrated_engine, monkeypatch):
    from scripts import migrate

    monkeypatch.setattr(migrate, "LOCK_TIMEOUT_SECONDS", 1)
    with migrated_engine.connect() as other:
        other.execute(text("select pg_advisory_lock(:id)"), {"id": migrate.LOCK_ID})
        try:
            with pytest.raises(migrate.MigrationError, match="Otro proceso"):
                migrate.apply_migrations(migrated_engine)
        finally:
            other.execute(text("select pg_advisory_unlock(:id)"), {"id": migrate.LOCK_ID})
            other.commit()
