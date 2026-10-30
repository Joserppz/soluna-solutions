"""Migraciones SQL versionadas (SCRUM-128 / SCRUM-152).

Aplica en orden los archivos ``migrations/NNN_nombre.sql`` que aún no figuran en la
tabla ``schema_migrations``. Cada migración se ejecuta en su propia transacción.

La conexión sale de ``MIGRATION_DATABASE_URL`` (en Supabase, el Session Pooler del puerto
5432) y, si no está definida, de ``DATABASE_URL``. La API usa el Transaction Pooler (6543),
que no sirve para migrar: cambia de conexión en cada transacción.

Uso (desde la carpeta Backend, con el entorno virtual activo):

    python -m scripts.migrate              # aplica las migraciones pendientes
    python -m scripts.migrate --status     # muestra aplicadas y pendientes
    python -m scripts.migrate --baseline 001
        # marca como aplicadas hasta la 001 sin ejecutarlas
        # (para una base donde el SQL ya se ejecutó a mano en el SQL Editor)
"""

import argparse
import os
import re
from pathlib import Path

from sqlalchemy import Engine, create_engine, text
from sqlalchemy.pool import NullPool

MIGRATIONS_DIR = Path(__file__).resolve().parent.parent / "migrations"
MIGRATION_PATTERN = re.compile(r"^(\d{3})_[a-z0-9_]+\.sql$")

CREATE_TRACKING_TABLE = """
create schema if not exists extensions;
create table if not exists public.schema_migrations (
  version     text primary key,
  name        text not null,
  applied_at  timestamptz not null default now()
);
alter table public.schema_migrations enable row level security;
do $$
begin
  if exists (select 1 from pg_roles where rolname = 'anon') then
    revoke all on public.schema_migrations from anon, authenticated;
  end if;
end;
$$;
"""


def run_sql_script(conn, sql: str) -> None:
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


def applied_versions(engine: Engine) -> set[str]:
    with engine.begin() as conn:
        run_sql_script(conn, CREATE_TRACKING_TABLE)
        return set(conn.execute(text("select version from public.schema_migrations")).scalars())


class MigrationError(RuntimeError):
    pass


def _schema_created_by_hand(engine: Engine, done: set[str]) -> bool:
    if done:
        return False
    with engine.connect() as conn:
        return conn.execute(text("select to_regclass('public.users') is not null")).scalar_one()


def apply_migrations(engine: Engine) -> list[str]:
    done = applied_versions(engine)
    if _schema_created_by_hand(engine, done):
        raise MigrationError(
            "La base ya tiene las tablas de la migración 001 pero no figura en "
            "schema_migrations (se ejecutó a mano en el SQL Editor). Ejecuta primero: "
            "python -m scripts.migrate --baseline 001"
        )
    applied = []
    for version, path in available_migrations():
        if version in done:
            continue
        with engine.begin() as conn:
            run_sql_script(conn, path.read_text(encoding="utf-8"))
            conn.execute(
                text("insert into public.schema_migrations (version, name) values (:v, :n)"),
                {"v": version, "n": path.name},
            )
        applied.append(path.name)
    return applied


def baseline(engine: Engine, up_to: str) -> list[str]:
    done = applied_versions(engine)
    marked = []
    with engine.begin() as conn:
        for version, path in available_migrations():
            if version > up_to or version in done:
                continue
            conn.execute(
                text("insert into public.schema_migrations (version, name) values (:v, :n)"),
                {"v": version, "n": path.name},
            )
            marked.append(path.name)
    return marked


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
    parser.add_argument("--baseline", metavar="VERSION", help="marca como aplicadas hasta VERSION")
    args = parser.parse_args()

    engine = migration_engine()

    if args.status:
        done = applied_versions(engine)
        for version, path in available_migrations():
            estado = "aplicada " if version in done else "PENDIENTE"
            print(f"[{estado}] {path.name}")
        return
    if args.baseline:
        marked = baseline(engine, args.baseline)
        print("Marcadas como aplicadas:", ", ".join(marked) if marked else "ninguna")
        return
    try:
        applied = apply_migrations(engine)
    except MigrationError as exc:
        raise SystemExit(f"ERROR: {exc}") from exc
    print("Migraciones aplicadas:", ", ".join(applied) if applied else "ninguna (todo al día)")


if __name__ == "__main__":
    main()
