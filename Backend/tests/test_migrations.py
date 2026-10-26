from sqlalchemy import text

from scripts.migrate import MIGRATION_PATTERN, available_migrations
from tests.conftest import requires_db


def test_migraciones_numeradas_y_en_orden():
    migrations = available_migrations()
    versions = [version for version, _ in migrations]

    assert versions, "Debe existir al menos la migración 001"
    assert versions == sorted(versions)
    assert all(MIGRATION_PATTERN.match(path.name) for _, path in migrations)


@requires_db
def test_migraciones_crean_las_tablas_del_modelo(migrated_engine):
    with migrated_engine.connect() as conn:
        tables = set(
            conn.execute(
                text("select tablename from pg_tables where schemaname = 'public'")
            ).scalars()
        )
        applied = set(conn.execute(text("select version from schema_migrations")).scalars())

    assert {
        "users",
        "sessions",
        "patients",
        "audit_logs",
        "schedules",
        "attendance",
        "inventory_items",
        "media_assets",
        "donations",
        "institutional_info",
        "patient_documents",
    } <= tables
    assert {"001", "002"} <= applied


@requires_db
def test_reaplicar_migraciones_no_hace_nada(migrated_engine):
    from scripts.migrate import apply_migrations

    assert apply_migrations(migrated_engine) == []
