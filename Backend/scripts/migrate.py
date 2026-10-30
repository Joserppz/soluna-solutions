"""Migraciones SQL versionadas (SCRUM-128 / SCRUM-152).

Aplica en orden los archivos ``migrations/NNN_nombre.sql`` que aún no figuran en la
tabla ``schema_migrations`` y guarda el SHA-256 de cada uno. Antes de aplicar nada:

- verifica que las migraciones ya aplicadas no hayan cambiado (checksum), y
- toma un bloqueo (``pg_advisory_lock``) para que dos despliegues no migren a la vez.

La conexión sale de ``MIGRATION_DATABASE_URL`` (en Supabase, el Session Pooler del puerto
5432) y, si no está definida, de ``DATABASE_URL``. La API usa el Transaction Pooler (6543),
que no sirve para migrar: cambia de conexión en cada transacción y pierde el bloqueo.

Uso (desde la carpeta Backend):
    python -m scripts.migrate              # aplica las migraciones pendientes
    python -m scripts.migrate --status     # muestra aplicadas y pendientes
"""

import argparse
import hashlib
import os
import re
import time
from pathlib import Path

from sqlalchemy import Connection, Engine, create_engine, text
from sqlalchemy.pool import NullPool

MIGRATIONS_DIR = Path(__file__).resolve().parent.parent / "migrations"
MIGRATION_PATTERN = re.compile(r"^(\d{3})_[a-z0-9_]+\.sql$")
# Número fijo para pg_advisory_lock: identifica "migraciones de ASPAR" en esta base
LOCK_ID = 20261030
LOCK_TIMEOUT_SECONDS = 120

CREATE_TRACKING_TABLE = """
create table if not exists public.schema_migrations (
  version     text primary key,
  name        text not null,
  checksum    text,
  applied_at  timestamptz not null default now()
);
alter table public.schema_migrations add column if not exists checksum text;
alter table public.schema_migrations enable row level security;
do $$
begin
  if exists (select 1 from pg_roles where rolname = 'anon') then
    revoke all on public.schema_migrations from anon, authenticated;
  end if;
end;
$$;
"""

OLD_DATABASE_HELP = (
    "Si es tu base local de Docker, reiníciala con: docker compose down -v && "
    "docker compose up --build. En Supabase, usa un proyecto nuevo (las migraciones del "
    "Sprint 1 se reemplazaron por 001_base.sql)."
)


class MigrationError(RuntimeError):
    pass


def checksum(path: Path) -> str:
    # Se normalizan los finales de línea: el mismo archivo da el mismo checksum en Windows
    content = path.read_bytes().replace(b"\r\n", b"\n")
    return hashlib.sha256(content).hexdigest()


def run_sql_script(conn: Connection, sql: str) -> None:
    # Cursor DBAPI sin parámetros: psycopg2 no interpreta los "%" del script (p. ej. format('%I'))
    with conn.connection.cursor() as cursor:
        cursor.execute(sql)


def available_migrations() -> list[tuple[str, Path]]:
    migrations = []
    for path in sorted(MIGRATIONS_DIR.glob("*.sql")):
        match = MIGRATION_PATTERN.match(path.name)
        if not match:
            raise ValueError(f"Nombre de migración inválido: {path.name} (use NNN_nombre.sql)")
        migrations.append((match.group(1), path))
    versions = [version for version, _ in migrations]
    if len(versions) != len(set(versions)):
        raise ValueError("Hay dos migraciones con el mismo número de versión")
    return migrations


def _applied(conn: Connection) -> dict[str, tuple[str, str | None]]:
    rows = conn.execute(text("select version, name, checksum from public.schema_migrations"))
    return {version: (name, digest) for version, name, digest in rows}


def verify_applied(applied: dict[str, tuple[str, str | None]]) -> None:
    """Las migraciones ya aplicadas deben seguir existiendo y no haber cambiado."""
    files = {version: path for version, path in available_migrations()}
    for version, (name, digest) in sorted(applied.items()):
        path = files.get(version)
        if path is None or path.name != name:
            raise MigrationError(
                f"La base tiene aplicada {name}, que ya no existe en migrations/. "
                + OLD_DATABASE_HELP
            )
        if digest is None:
            raise MigrationError(
                f"{name} se aplicó sin checksum (versión antigua del aplicador). "
                + OLD_DATABASE_HELP
            )
        if digest != checksum(path):
            raise MigrationError(
                f"{name} cambió después de aplicarse. Nunca edites una migración aplicada: "
                "deshaz el cambio y crea la siguiente (NNN_nombre.sql)."
            )


def _acquire_lock(conn: Connection) -> None:
    deadline = time.monotonic() + LOCK_TIMEOUT_SECONDS
    while not conn.execute(text("select pg_try_advisory_lock(:id)"), {"id": LOCK_ID}).scalar_one():
        if time.monotonic() > deadline:
            raise MigrationError(
                "Otro proceso está aplicando migraciones en esta base. Espera a que termine."
            )
        time.sleep(1)


def apply_migrations(engine: Engine) -> list[str]:
    applied_now: list[str] = []
    # Una sola conexión: el bloqueo de sesión dura mientras se aplican todas
    with engine.connect() as conn:
        _acquire_lock(conn)
        conn.commit()  # el bloqueo es de sesión: sigue vigente después del commit
        try:
            with conn.begin():
                run_sql_script(conn, CREATE_TRACKING_TABLE)
            with conn.begin():
                applied = _applied(conn)
            verify_applied(applied)
            for version, path in available_migrations():
                if version in applied:
                    continue
                with conn.begin():
                    run_sql_script(conn, path.read_text(encoding="utf-8"))
                    conn.execute(
                        text(
                            "insert into public.schema_migrations (version, name, checksum) "
                            "values (:v, :n, :c)"
                        ),
                        {"v": version, "n": path.name, "c": checksum(path)},
                    )
                applied_now.append(path.name)
        finally:
            conn.execute(text("select pg_advisory_unlock(:id)"), {"id": LOCK_ID})
            conn.commit()
    return applied_now


def status(engine: Engine) -> list[tuple[str, str]]:
    with engine.begin() as conn:
        run_sql_script(conn, CREATE_TRACKING_TABLE)
        applied = _applied(conn)
    result = []
    for version, path in available_migrations():
        if version not in applied:
            result.append(("PENDIENTE", path.name))
        elif applied[version][1] != checksum(path):
            result.append(("MODIFICADA", path.name))
        else:
            result.append(("aplicada", path.name))
    return result


def migration_engine() -> Engine:
    url = os.getenv("MIGRATION_DATABASE_URL")
    if not url:
        from app.core.database import engine

        return engine
    from app.core.database import sqlalchemy_url

    return create_engine(sqlalchemy_url(url), poolclass=NullPool)


def main() -> None:
    parser = argparse.ArgumentParser(description="Migraciones SQL versionadas de ASPAR")
    parser.add_argument("--status", action="store_true", help="muestra el estado")
    args = parser.parse_args()

    engine = migration_engine()
    if args.status:
        for state, name in status(engine):
            print(f"[{state:10}] {name}")
        return
    try:
        applied = apply_migrations(engine)
    except MigrationError as exc:
        raise SystemExit(f"ERROR: {exc}") from exc
    print("Migraciones aplicadas:", ", ".join(applied) if applied else "ninguna (todo al día)")


if __name__ == "__main__":
    main()
