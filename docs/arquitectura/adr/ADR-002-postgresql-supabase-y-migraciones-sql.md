# ADR-002: PostgreSQL en Supabase con migraciones SQL versionadas

- **Estado:** Aceptada
- **Fecha:** 2026-10-26
- **Requisitos:** RF-02, RNF-11, diagrama C2 (contenedor «Base de Datos»)

## Contexto

El C2 define PostgreSQL como base de datos, pero la primera versión usaba un archivo SQLite (`aspar.db`) que no sirve para un despliegue compartido. ASPAR no tiene presupuesto para un servidor propio de base de datos.

## Decisión

- Usar **PostgreSQL gestionado en Supabase** (plan gratuito) como base de producción.
- Definir el esquema con **migraciones SQL numeradas** en `Backend/migrations/` (`001_initial_schema.sql`, `002_patient_documents.sql`), aplicadas por `python -m scripts.migrate`, que registra cada versión en la tabla `schema_migrations`.
- Usar **SQLAlchemy** solo como ORM para leer y escribir, no para generar el esquema.
- Las reglas de integridad viven en la base: `CHECK` de roles, estados y estadios, CI única, `access_status <> 'Activo' OR consent`.

## Alternativas descartadas

- **Alembic:** genera migraciones desde los modelos, pero el equipo ya escribía SQL y Supabase ejecuta SQL directamente en su editor; se priorizó un solo formato legible.
- **Seguir con SQLite:** no soporta varios usuarios a la vez ni el despliegue en la nube.

## Consecuencias

- ✅ El mismo SQL corre en Supabase, en el CI (PostgreSQL 16) y en local.
- ✅ Una migración ya aplicada nunca se edita; los cambios van en un archivo nuevo.
- ⚠️ Los modelos ORM (`app/modules/*/models.py`) deben mantenerse a mano en sincronía con el SQL. `test_migrations.py` verifica el esquema resultante.
- ⚠️ La migración 001 siembra cuentas de administrador con contraseña conocida (`Admin123`). **Deben cambiarse en Supabase de producción.**

## Evidencia

`Backend/migrations/`, `Backend/scripts/migrate.py`, `Backend/tests/test_migrations.py`, paso «Aplicar migraciones» de `.github/workflows/ci-backend.yml`.
