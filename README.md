# Soluna Solutions — Sistema Web y de Gestión para ASPAR

[![Frontend CI](https://github.com/Joserppz/soluna-solutions/actions/workflows/ci-frontend.yml/badge.svg?branch=Sprint1)](https://github.com/Joserppz/soluna-solutions/actions/workflows/ci-frontend.yml)
[![Backend CI](https://github.com/Joserppz/soluna-solutions/actions/workflows/ci-backend.yml/badge.svg?branch=Sprint1)](https://github.com/Joserppz/soluna-solutions/actions/workflows/ci-backend.yml)

Repositorio oficial de **Soluna Solutions** para el proyecto **ASPAR (Asociación de Parkinson "Mario Lagrava")**, desarrollado en la materia de Ingeniería de Software — Universidad Católica Boliviana "San Pablo" (La Paz, Bolivia).

## Integrantes del Equipo

- **José Fabián Rodríguez Porco** — Director de Proyecto y Analista de Sistemas
- **Dayana Gretel Rojas Valencia** — Arquitecta de Software y Desarrolladora Backend
- **Fabián Mauricio Condorena Lazarte** — Especialista QA y Desarrollador Frontend

## Arquitectura del Repositorio

- [`Frontend/`](./Frontend/README.md): Aplicación web SPA en Vue 3 + TypeScript + Vite (Portal público y Panel administrativo/clínico). La capa `src/api/` habla con la API con cookies y CSRF, y sus tipos se generan desde el contrato OpenAPI ([ADR-013](./docs/arquitectura/adr/ADR-013-contrato-openapi-y-capa-src-api.md)).
- [`Backend/`](./Backend/README.md): API RESTful en Python + FastAPI sobre **Supabase PostgreSQL**, organizada por módulos de dominio (`app/modules/<dominio>/` con router, service, repository, schemas y models; [ADR-011](./docs/arquitectura/adr/ADR-011-backend-por-modulos-de-dominio.md)). Incluye sesión en cookies HttpOnly, permisos por rol en la base ([ADR-012](./docs/arquitectura/adr/ADR-012-sesion-en-cookies-y-permisos-en-la-base.md)), afiliados con protección RNF-06, documentos privados y bitácora de auditoría.
- [`docs/`](./docs/):
  - `docs/entrevistas/DOCUMENTO_1.pdf`: Minuta de entrevista y relevamiento AS-IS / TO-BE.
  - `docs/srs/DOCUMENTO_2.pdf`: Especificación de Requisitos de Software (SRS v1.0).
  - [`docs/api/CONTRATO_API_LOGIN_PACIENTES.md`](./docs/api/CONTRATO_API_LOGIN_PACIENTES.md) y [`docs/api/openapi.json`](./docs/api/openapi.json): Contrato API Backend ↔ Frontend y especificación OpenAPI.
  - [`docs/srs/SRS_ADENDA_SPRINT1.md`](./docs/srs/SRS_ADENDA_SPRINT1.md): Adenda al SRS con RF-11, RF-17, RNF-06 y RNF-11 y los cambios de RF-01, RNF-02 y RNF-05.
  - `docs/arquitectura/DOCUMENTO_3.pdf` y [`MODELO_DATOS_Y_CONTRATOS.md`](./docs/arquitectura/MODELO_DATOS_Y_CONTRATOS.md): Modelo C4 (C1, C2, C3) y contratos de datos.
  - [`docs/arquitectura/C4_Y_MODELO_ER_ACTUALIZADO.md`](./docs/arquitectura/C4_Y_MODELO_ER_ACTUALIZADO.md) y [`docs/arquitectura/adr/`](./docs/arquitectura/adr/README.md): Diagramas C4 y E-R vigentes y decisiones técnicas (ADR).
  - [`docs/trazabilidad/MATRIZ_RF01_RF17.md`](./docs/trazabilidad/MATRIZ_RF01_RF17.md): Trazabilidad completa RF01–RF17 y RNF01–RNF11.
  - `docs/bpmn/`: Modelado de procesos principales en BPMN 2.0 y revisión de pasos de usuario.
  - `docs/wireframes/`: Wireframes del portal público y del panel administrativo.
  - `docs/evidencias/`: Capturas, recorrido integrado, evidencias del Backend y de CI/cobertura del Sprint 1.
  - `docs/calidad/`: Informe de verificación, Definición de Hecho (DoD) y estado real del Sprint 1.
  - `docs/git/`: Convención de ramas, commits y Pull Requests, y trazabilidad con Jira.
  - [`docs/despliegue/GUIA_DE_DESPLIEGUE.md`](./docs/despliegue/GUIA_DE_DESPLIEGUE.md): Despliegue en Cloud Run con Secret Manager, staging, servicios externos y respaldos ([ADR-014](./docs/arquitectura/adr/ADR-014-despliegue-y-operacion.md)).

## Puesta en marcha con Docker (recomendado)

Requisito: [Docker Desktop](https://www.docker.com/products/docker-desktop/) (en Windows, con WSL 2). Desde la raíz del repositorio:

```bash
docker compose up --build
```

| Servicio | Dirección | Qué es |
| :--- | :--- | :--- |
| `web` | <http://localhost:5173> | Frontend Vue con recarga automática |
| `api` | <http://localhost:8000/docs> | API FastAPI; aplica las migraciones pendientes al arrancar |
| `db` | `localhost:5433` (usuario `aspar`, clave `aspar_local`) | PostgreSQL 16 con las bases `aspar` y `aspar_test` |

`docker compose down` detiene todo (los datos se conservan) y `docker compose down -v` borra la base local. Los atajos de [`Makefile`](./Makefile) (`make test`, `make lint`, `make migrate`, `make psql`…) envuelven esos comandos; `make help` los lista. En Windows sin `make`, cada objetivo del `Makefile` muestra el comando `docker compose` equivalente.

Opcional: `pip install pre-commit && pre-commit install` revisa Ruff, ESLint y Prettier antes de cada commit ([`.pre-commit-config.yaml`](./.pre-commit-config.yaml)).

## Puesta en marcha sin Docker

| Paso | Backend (`Backend/`) | Frontend (`Frontend/`) |
| :--- | :--- | :--- |
| 1. Requisitos | Python 3.12+ y un proyecto Supabase | Node.js 22 LTS |
| 2. Dependencias | `python3.12 -m venv .venv`, `source .venv/bin/activate`, `pip install -r requirements-dev.txt` | `npm install` |
| 3. Entorno | `cp .env.example .env` y completar `DATABASE_URL` y `JWT_SECRET` | `cp .env.example .env` |
| 4. Base de datos | `python -m scripts.migrate` y, solo en desarrollo, `python -m scripts.seed_demo` (cuentas de prueba) | — |
| 5. Ejecutar | `uvicorn app.main:app --reload` → <http://localhost:8000/docs> | `npm run dev` → <http://localhost:5173> |

La guía completa del Backend (variables, migraciones, permisos por rol, pruebas y problemas frecuentes) está en [`Backend/README.md`](./Backend/README.md).

**En Windows** (PowerShell o CMD), el entorno virtual se activa con `.venv\Scripts\activate` y los archivos se copian con `copy .env.example .env`. Los comandos `cp` y `source` son de Git Bash, macOS o Linux.

## Variables de entorno

| Archivo | Variables obligatorias | Opcionales |
| :--- | :--- | :--- |
| [`Backend/.env.example`](./Backend/.env.example) | `DATABASE_URL`, `JWT_SECRET` (mínimo 32 caracteres aleatorios) | `MIGRATION_DATABASE_URL`, sesión (`SESSION_*`), cookies (`COOKIE_*`), `CORS_ORIGINS`, correo (`EMAIL_PROVIDER`, `RESEND_API_KEY`…), `TURNSTILE_SECRET_KEY`, `GOOGLE_CLIENT_ID`, `SUPABASE_*`, `RATE_LIMITS_ENABLED` |
| [`Frontend/.env.example`](./Frontend/.env.example) | — | `VITE_API_BASE_URL` (por defecto `http://localhost:8000/api/v1`), `VITE_DEMO_MODE` (por defecto `false`), `VITE_GOOGLE_CLIENT_ID`, `VITE_TURNSTILE_SITE_KEY` |

- Los archivos `.env` reales **nunca** se suben al repositorio.
- La API se niega a arrancar si `JWT_SECRET` es el valor de ejemplo. Con `ENV=prod` también se niega si falta algún ajuste de producción: correo real, Turnstile real, cookies `Secure`, límites de peticiones activos y CORS solo `https`.
- En producción y staging no hay `.env`: los secretos viven en Google Secret Manager.

## Pruebas y calidad

| Comando | Dónde | Qué valida |
| :--- | :--- | :--- |
| `npm run lint` · `npm run test:coverage` · `npm run build` | `Frontend/` | ESLint, pruebas con cobertura mínima de 70% y tipos TypeScript |
| `npm run api:types:check` · `npm audit` | `Frontend/` | Tipos de la API iguales al contrato `docs/api/openapi.json`; dependencias sin vulnerabilidades conocidas |
| `ruff check .` · `ruff format --check .` · `pytest --cov=app` | `Backend/` | Estilo, pruebas unitarias y de API, cobertura mínima de 70% |
| `pip-audit -r requirements.txt` · `docker build --target runtime Backend` | `Backend/` | Dependencias sin vulnerabilidades conocidas; la imagen de producción se construye, corre sin root y rechaza una configuración insegura |

- Los mismos pasos corren en GitHub Actions en cada push a `Sprint*`, `SCRUM-*` o `main`. El pipeline del Backend corre cuando cambian `Backend/`, los tipos del Frontend o `docs/api/openapi.json`. Ver [`docs/evidencias/EVIDENCIAS_CI_Y_COBERTURA_SPRINT1.md`](./docs/evidencias/EVIDENCIAS_CI_Y_COBERTURA_SPRINT1.md).
- **Dependabot** ([`.github/dependabot.yml`](./.github/dependabot.yml)) abre cada lunes Pull Requests con las actualizaciones de npm, pip, la imagen de Python y GitHub Actions. Las de seguridad llegan apenas se publica la alerta. Cada PR pasa por el mismo CI antes de integrarse.

## Despliegue

| Entorno | Frontend | API (Google Cloud Run) | Base y archivos |
| :--- | :--- | :--- | :--- |
| Staging | `staging.aspar.com` | `api.staging.aspar.com` | Proyecto Supabase propio, sin datos reales |
| Producción | `aspar.com` | `api.aspar.com` | Proyecto Supabase `aspar-prod` |

- **Secretos:** en Google Secret Manager, uno por entorno. Cloud Run los entrega como variables de entorno.
- **Conexiones a la base:** la API usa `DATABASE_URL` con un usuario sin permisos de esquema (`aspar_api`). Las migraciones corren antes de cada versión en un Cloud Run Job con `MIGRATION_DATABASE_URL`.
- **Configuración manual una vez por entorno:**
  - Google Client ID para «Continuar con Google»;
  - Cloudflare Turnstile;
  - Resend, con el dominio verificado por DNS.
- **Respaldos:** diarios de la base y de los documentos, con 30 días de retención y una prueba de restauración mensual en staging.

Paso a paso: [`docs/despliegue/GUIA_DE_DESPLIEGUE.md`](./docs/despliegue/GUIA_DE_DESPLIEGUE.md). Decisiones: [ADR-014](./docs/arquitectura/adr/ADR-014-despliegue-y-operacion.md).

## Flujo de trabajo

Cada subtarea de Jira se trabaja en la rama de su historia o tarea (`SCRUM-XX`), con commits `tipo(SCRUM-XX/SCRUM-YY): descripción`, y se integra por Pull Request hacia la rama del sprint (`Sprint1`). Detalle en [`docs/git/FLUJO_GIT_Y_PULL_REQUESTS.md`](./docs/git/FLUJO_GIT_Y_PULL_REQUESTS.md).
