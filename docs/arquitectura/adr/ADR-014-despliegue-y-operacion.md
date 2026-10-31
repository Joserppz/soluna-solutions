# ADR-014: Despliegue y operación — Cloud Run, Secret Manager, staging y respaldos

- **Estado:** Propuesta (se acepta al hacer el primer despliegue)
- **Fecha:** 2026-10-31
- **Requisitos:** RNF-02, RNF-06, RNF-10, RNF-11

## Contexto

Hasta el Sprint 2 el sistema solo corre en el entorno local (Docker). Para publicarlo hace falta decidir:

- dónde corre la API;
- cómo se guardan los secretos;
- cómo se aplican las migraciones;
- cómo se prueba antes de producción;
- qué servicios externos hay que configurar a mano;
- cómo se recuperan los datos si algo sale mal.

## Decisión

### Arquitectura

| Pieza | Producción | Staging |
| :--- | :--- | :--- |
| Frontend (Vue, estático) | `https://aspar.com` | `https://staging.aspar.com` |
| API (imagen `runtime` del `Backend/Dockerfile`) | Cloud Run `aspar-api` → `https://api.aspar.com` | Cloud Run `aspar-api-staging` → `https://api.staging.aspar.com` |
| Base y documentos | Proyecto Supabase `aspar-prod` | Proyecto Supabase `aspar-staging` |
| Secretos | Secret Manager `aspar-prod-*` | Secret Manager `aspar-staging-*` |

- La API sigue la arquitectura modular de [ADR-011](./ADR-011-backend-por-modulos-de-dominio.md) y el frontend usa la capa `src/api/` de [ADR-013](./ADR-013-contrato-openapi-y-capa-src-api.md).
- **Staging es una copia completa y separada:** su propia API, base, bucket, secretos y cookies (`COOKIE_DOMAIN` vacío, ver [ADR-012](./ADR-012-sesion-en-cookies-y-permisos-en-la-base.md)). Corre con `ENV=prod`, así valida lo mismo que producción. Nunca tiene datos reales de afiliados.
- Región `southamerica-east1` (São Paulo), junto a Supabase `sa-east-1`.

### Secretos en Google Secret Manager

- Secretos: `JWT_SECRET`, `DATABASE_URL`, `MIGRATION_DATABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`, `RESEND_API_KEY` y `TURNSTILE_SECRET_KEY`.
- Viven en Secret Manager y Cloud Run los inyecta como variables de entorno (`--set-secrets`).
- Nunca están en el repositorio, en la imagen ni en los argumentos del despliegue.
- Cada servicio usa su propia cuenta de servicio, con `roles/secretmanager.secretAccessor` solo sobre sus secretos.
- Los valores no secretos (`ENV`, `CORS_ORIGINS`, `FRONTEND_URL`, `GOOGLE_CLIENT_ID`…) van en un archivo `--env-vars-file`.

### Dos conexiones a la base

| Variable | Conexión | Usuario | Lo usa |
| :--- | :--- | :--- | :--- |
| `DATABASE_URL` | Transaction Pooler (6543), `DB_POOL=null` | `aspar_api`: solo lee y escribe datos | la API |
| `MIGRATION_DATABASE_URL` | Session Pooler (5432) | dueño del esquema (`postgres`) | el job `aspar-migrate` |

- Las migraciones corren en un **Cloud Run Job** con la misma imagen, **antes** de desplegar la nueva revisión de la API.
- `scripts.migrate` toma un bloqueo, verifica el SHA-256 de lo aplicado y se detiene si una migración aplicada fue modificada.
- La API no puede crear, alterar ni borrar tablas.

### Servicios externos configurados a mano

Cada servicio se configura una vez por entorno. Los pasos están en [`docs/despliegue/GUIA_DE_DESPLIEGUE.md`](../../despliegue/GUIA_DE_DESPLIEGUE.md).

- **Google Client ID** (Continuar con Google): Google Cloud → Credenciales → ID de cliente OAuth web, con los orígenes de cada entorno.
- **Cloudflare Turnstile**: un widget por dominio. La *site key* va al frontend y la *secret key* a Secret Manager.
- **Resend**: dominio `aspar.com` verificado por DNS (SPF, DKIM y DMARC) y una clave con permiso solo de envío.

### Respaldos

| Qué | Cómo | Frecuencia | Retención |
| :--- | :--- | :--- | :--- |
| Base de datos | Respaldos automáticos de Supabase (según el plan) **y** `pg_dump` propio en un Cloud Run Job programado, guardado en un bucket privado de Cloud Storage | Diaria | 30 días (regla de ciclo de vida del bucket) |
| Documentos privados (bucket de Supabase Storage) | Copia al mismo bucket de respaldos (los respaldos de la base no incluyen los archivos) | Diaria | 30 días |
| Prueba de restauración | Restaurar el último respaldo en staging y revisar el recorrido principal | Cada mes | — |

Objetivo: perder como máximo 24 horas de datos (RPO) y volver a operar en menos de 4 horas (RTO). Los respaldos tienen datos clínicos: el bucket es privado, cifrado y solo accesible para la cuenta de servicio del job y la dirección del proyecto.

### CI/CD

- GitHub Actions valida en cada push:
  - Backend: Ruff, migraciones, pytest con cobertura de 70 %, `pip-audit` y la imagen Docker.
  - Frontend: ESLint, Prettier, tipos OpenAPI, Vitest con cobertura de 70 %, build y `npm audit`.
- Dependabot propone cada semana las actualizaciones de npm, pip, Docker y GitHub Actions.

## Alternativas

- *Variables de entorno escritas en la consola de Cloud Run*: quedan visibles para cualquiera con acceso al servicio y no tienen versiones. Descartada.
- *Una sola API para producción y staging*: un error en staging toca datos reales. Descartada.
- *Migrar al arrancar la API*: varias instancias migrarían a la vez y la API necesitaría permisos de dueño. Descartada (en Docker local sí se hace, por comodidad).
- *Solo los respaldos de Supabase*: dependen del plan y no incluyen los archivos de Storage. Descartada como única medida.

## Consecuencias

- ✅ Rotar un secreto es crear una versión nueva en Secret Manager y desplegar una revisión. El código no cambia.
- ✅ Una filtración de `DATABASE_URL` no permite borrar tablas ni editar la bitácora.
- ⚠️ Cuesta dos proyectos de Supabase y dos servicios de Cloud Run (el de staging puede escalar a cero).
- ⚠️ Los respaldos propios y su prueba mensual son una tarea del equipo. Si nadie la hace, el respaldo no sirve.

## Evidencia

`Backend/Dockerfile` (etapa `runtime`), `Backend/scripts/migrate.py`, `Backend/app/core/config.py` (validaciones de producción), `.github/workflows/`, `.github/dependabot.yml`, `docs/despliegue/GUIA_DE_DESPLIEGUE.md`.
