# Principios de diseño: SOLID y buenas prácticas en el código de ASPAR

Este documento muestra dónde y cómo se aplican los principios de diseño, con ejemplos del código real, para revisarlos en minutos o explicarlos en la defensa.

**Estilo de arquitectura:** un **monolito modular por dominios** con una **base relacional única** y servicios gestionados, decidido en [ADR-001](./adr/ADR-001-api-fastapi-en-capas.md) y [ADR-011](./adr/ADR-011-backend-por-modulos-de-dominio.md).

**Por qué no microservicios:**

- El equipo es pequeño y el sistema es de una sola organización: separar en servicios multiplicaría despliegues, bases y costos sin un beneficio a esta escala.
- Algunas operaciones cruzan módulos y deben ser atómicas. Por ejemplo, una donación en especie que entra al inventario se guarda en una sola transacción ACID.
- Si un módulo crece, puede separarse sin rehacer el resto, porque ya tiene sus capas y su API propias.

## 1. SOLID

| Principio | Dónde se ve | Ejemplo |
| :--- | :--- | :--- |
| **S — Responsabilidad única** | Cada módulo de `Backend/app/modules/<dominio>/` separa cinco piezas: `router.py` (HTTP y permisos), `service.py` (reglas de negocio), `repository.py` (consultas), `schemas.py` (validación de entrada y salida) y `models.py` (tablas) | `donations/service.py:confirm` solo decide si un aviso se confirma. No sabe de HTTP ni escribe SQL; eso lo hacen el router y el repositorio |
| **O — Abierto/cerrado** | Los reportes se extienden sin tocar el núcleo: cada pantalla describe sus hojas (`Sheet`) y su filtro (`Report`), y `core/reports.py:download` genera Excel o PDF para todas | Agregar el PDF no cambió ningún módulo: solo `core/pdf.py` y una rama en `download`. Un formato nuevo se suma igual |
| **L — Sustitución de Liskov** | Cada adaptador externo cumple el mismo contrato que su alternativa: `ConsoleEmailSender`, `ResendEmailSender` y `BrevoEmailSender` son intercambiables para el servicio que envía el correo | En desarrollo y en las pruebas, el correo se escribe en consola o en un buzón falso. En producción sale por Brevo, sin cambiar los servicios que lo usan |
| **I — Segregación de interfaces** | Interfaces pequeñas con `typing.Protocol`: `EmailSender` (enviar un correo), `TurnstileVerifier` (verificar un captcha), `PrivateStorage` (documentos privados), `MediaSigner` (firmar subidas a Cloudinary), `GoogleVerifier` (validar el token de Google) | Un módulo depende solo del método que necesita; por ejemplo, las solicitudes públicas dependen de `TurnstileVerifier`, no de todo Cloudflare |
| **D — Inversión de dependencias** | Los routers reciben sus dependencias con `Depends(...)` de FastAPI (`get_email_sender`, `get_turnstile`, `get_private_storage`, `require_permission`) y los servicios trabajan contra los protocolos, no contra los SDK | Las pruebas reemplazan cada dependencia (`app.dependency_overrides` en `tests/conftest.py`). Las pruebas unitarias reemplazan además repositorios, registro y reloj con `unittest.mock` ([`tests/unit/`](../../Backend/tests/unit/)) |

En el **Frontend** se aplica lo mismo:

- **Responsabilidad única:**
  - `src/api/` es la única capa que habla con la API (cookies, CSRF y errores);
  - las vistas en `src/views/` arman pantallas;
  - los componentes de `src/components/ui/` no conocen la API;
  - los *composables* (`useFloating`, `useFitRows`, `useUnsavedChanges`, `useIdleSession`) encapsulan un solo comportamiento reutilizable.
- **Abierto/cerrado:** `ExportMenu` acepta una lista de reportes (`items`) y `DateRangeFilter`, cualquier rango, así que una pantalla nueva los usa sin modificarlos.
- **Inversión de dependencias:** las vistas reciben la API con `useApi()`, y en las pruebas se sustituye por una API simulada (`src/__test__/apiFake.ts`).

## 2. Otras prácticas

| Práctica | Cómo se aplica |
| :--- | :--- |
| **Arquitectura en capas y por dominio** | 16 módulos con la misma estructura. El núcleo común (`app/core/`) tiene lo transversal: configuración tipada, una transacción por petición, errores de dominio, paginación, reloj de Bolivia, límites de intentos, logging y reportes |
| **DRY (no repetir)** | Filtro por fechas (`core/reports.py:within`), descarga (`download`) y paginación compartidos por las 9 pantallas. En el Frontend, un solo calendario (`CalendarGrid`) para filtros, formularios y asistencia |
| **Contrato primero** | `docs/api/openapi.json` se genera del código, y el CI falla si cambia sin actualizarse. Los tipos de `Frontend/src/api/schema.d.ts` salen de ese contrato ([ADR-013](./adr/ADR-013-contrato-openapi-y-capa-src-api.md)) |
| **Base de datos versionada** | Migraciones SQL numeradas con huella SHA-256: una migración aplicada no se edita, se agrega otra ([`scripts/migrate.py`](../../Backend/scripts/migrate.py)). Restricciones en la base (FK, `CHECK`, índices únicos) además de las del servicio |
| **Seguridad por diseño** | Permisos por rol en la base y comprobados en el servidor; datos clínicos con triple condición (RNF-06); bitácora inmutable; cookies HttpOnly con CSRF; secretos fuera del código (Secret Manager); CORS y Turnstile en producción ([ADR-003](./adr/ADR-003-jwt-con-sesiones-en-servidor.md) a [ADR-007](./adr/ADR-007-supabase-solo-desde-el-backend.md), [ADR-012](./adr/ADR-012-sesion-en-cookies-y-permisos-en-la-base.md)) |
| **Pirámide de pruebas** | Unitarias con dobles (42, sin base), de API contra PostgreSQL (483), de componentes y pantallas con Vitest (413) y de punta a punta con Playwright (121). Cobertura mínima del 70 % exigida por el CI (hoy 98 % y 92,7 %) |
| **Código limpio y uniforme** | Ruff (lint y formato) en el Backend; ESLint, Prettier y TypeScript estricto en el Frontend; `pre-commit` opcional. Nombres y mensajes en español del dominio de ASPAR |
| **Integración continua** | GitHub Actions en cada push: lint, tipos, pruebas, cobertura, contrato, `pip-audit` y `npm audit`, e imagen Docker de producción sin root. Dependabot semanal |
| **Git ordenado** | Ramas por historia, Conventional Commits con la clave de Jira, Pull Requests y etiquetas de versión ([guía](../git/FLUJO_GIT_Y_PULL_REQUESTS.md)) |
| **Decisiones documentadas** | 15 ADR con contexto, decisión, alternativas y consecuencias ([índice](./adr/README.md)) |
| **Observabilidad** | Logs en JSON con `request_id`, endpoint de salud con la base (`/api/v1/health/db`), monitoreo programado ([`disponibilidad.yml`](../../.github/workflows/disponibilidad.yml)) y respaldo diario cifrado ([`backup.yml`](../../.github/workflows/backup.yml)) |
