# Modelo de datos, permisos y contrato Frontend–Backend (SCRUM-64 / SCRUM-105)

Este documento explica **cómo se conectan** el Frontend Vue 3 y la API FastAPI al cerrar el Backend del Sprint 2: la sesión, los permisos, los módulos y el contrato de datos.

- **Diagramas C4 y E-R vigentes:** [`C4_Y_MODELO_ER_ACTUALIZADO.md`](./C4_Y_MODELO_ER_ACTUALIZADO.md).
- **Decisiones:** [ADR-011](./adr/ADR-011-backend-por-modulos-de-dominio.md) (módulos), [ADR-012](./adr/ADR-012-sesion-en-cookies-y-permisos-en-la-base.md) (cookies y permisos) y [ADR-013](./adr/ADR-013-contrato-openapi-y-capa-src-api.md) (contrato OpenAPI).
- **Detalle de login, sesiones y afiliados:** [`CONTRATO_API_LOGIN_PACIENTES.md`](../api/CONTRATO_API_LOGIN_PACIENTES.md).

## 1. Sesión: cookies HttpOnly + CSRF

La API **no usa** `Authorization: Bearer`. El token nunca llega a JavaScript, así que un script inyectado (XSS) no puede robarlo.

| Pieza | Valor | Para qué |
| :--- | :--- | :--- |
| Cookie `aspar_session` | JWT HS256 `{sub, sid, iat, exp}` · `HttpOnly`, `Secure`, `SameSite=Lax`, `Path=/api` | Identifica la sesión. Solo la lee la API |
| Cookie `aspar_csrf` | HMAC-SHA256 del `sid` · legible por el frontend, `Path=/` | El frontend la copia en el encabezado |
| Encabezado `X-CSRF-Token` | Mismo valor que `aspar_csrf` (también llega en `csrfToken` de la respuesta de sesión) | Obligatorio en `POST`, `PUT`, `PATCH` y `DELETE`. Sin él: **403** |
| `OriginCheckMiddleware` | Rechaza con **403** un `Origin` que no está en `CORS_ORIGINS` | Segunda barrera contra CSRF |
| Tabla `sessions` | `expires_at` (30 min), `last_activity_at` (15 min), `absolute_expires_at` (8 h), `revoked_at` | La validez real se decide en el servidor en cada petición |

- **El JWT solo dice qué fila de `sessions` buscar.** Si la fila no existe, está revocada, vencida o inactiva más de 15 minutos, la API responde **401** aunque la firma sea válida.
- **Renovación:** `POST /auth/refresh` extiende `expires_at` otros 30 minutos, nunca más allá del tope de 8 horas desde el login.
- **Cierre:** `POST /auth/logout` revoca la fila y borra las dos cookies. Restablecer la contraseña (por correo o desde Administración) revoca **todas** las sesiones de la cuenta; cambiarla uno mismo revoca las demás y conserva la actual.
- **Navegador:** el frontend envía `credentials: 'include'`. En producción la SPA (`aspar.com`) y la API (`api.aspar.com`) son el mismo sitio, por eso basta `SameSite=Lax`. Staging tiene sus propias cookies (`COOKIE_DOMAIN` vacío, ADR-014).

## 2. Permisos dinámicos (RBAC en la base)

Los permisos **no están escritos en el código** de cada pantalla: viven en las tablas `roles`, `permissions` y `role_permissions`. Administración los cambia desde el panel (`PUT /roles/{key}/permissions`) sin desplegar nada.

| Permiso | Qué permite | Sensible | Roles iniciales |
| :--- | :--- | :---: | :--- |
| `patients:read` | Ver afiliados y sus contactos | | Todos |
| `patients:write` | Registrar y editar fichas (filiación y consentimiento) | | Coord., Prof., Recep. |
| `patients:read_clinical` | Ver anamnesis, evaluaciones y documentos | ⚠️ | Coord., Prof. |
| `patients:write_clinical` | Registrar síntomas, medicación y evaluaciones | ⚠️ | Coord., Prof. |
| `patients:deactivate` | Dar de baja o reactivar una ficha | ⚠️ | — |
| `documents:upload` | Subir documentos privados | | Coord., Prof., Recep. |
| `documents:delete` | Eliminar documentos privados | ⚠️ | — |
| `attendance:write` | Tomar y cerrar la asistencia | | Todos |
| `schedules:manage` | Crear, publicar y cancelar actividades | | Coord. |
| `inventory:manage` | Materiales, movimientos y bajas | | Coord. |
| `donations:manage` | Confirmar, anular y registrar aportes; editar la meta | | Coord., Recep. |
| `inquiries:manage` | Atender solicitudes e inscribir afiliados | | Coord., Recep. |
| `media:manage` | Galería y publicación de álbumes | | Coord. |
| `content:manage` | Editar y publicar el contenido del sitio | | Coord. |
| `users:manage` | Equipo, aprobación de cuentas y asignación de roles | ⚠️ | — |
| `roles:manage` | Cambiar los permisos de los roles | ⚠️ | — |
| `audit:read` | Consultar el registro de actividad | ⚠️ | — |

«Todos» son Coordinación, Profesional, Recepción y Voluntariado. **Administración** (`admin`, rol del sistema) tiene siempre los 17 permisos.

**Reglas:**

- **Administración es inmutable:** la API responde 409 si se intenta editar y dos triggers de la base lo impiden aunque se salte la API.
- **Permisos sensibles:** dar uno de los marcados ⚠️ exige `confirmSensitive: true`. Sin esa confirmación la API responde 409 con la lista de lo que se va a conceder. El cambio queda en la bitácora como `CRITICAL`.
- **Cuentas pendientes:** una cuenta registrada por el sitio o con Google entra **sin rol** («Pendiente de aprobación») y no pasa ninguna verificación hasta que Administración la aprueba (`POST /users/{id}/approve`).
- **Contraseña temporal:** mientras `mustChangePassword` es `true`, la cuenta solo puede cambiar su contraseña.
- **En la API:** cada endpoint declara `require_permission(...)`. Cada rechazo es un **403** y queda en la bitácora (agrupado para no inundarla).
- **En el frontend:** `session.can('patients:read')` y `session.canAny(...)` deciden qué menús y botones mostrar. Es solo comodidad: la API vuelve a verificar en cada petición.
- **RNF-06 va más allá del permiso:** aun con `patients:read_clinical`, la anamnesis solo se entrega si el afiliado tiene consentimiento firmado y acceso `Activo` (ver el [contrato de afiliados](../api/CONTRATO_API_LOGIN_PACIENTES.md#4-afiliados-y-privacidad-clínica-rf-02-rnf-06)).

## 3. Los 16 módulos del Backend

Cada módulo está en `Backend/app/modules/<dominio>/` con `router.py`, `service.py`, `repository.py`, `models.py` y `schemas.py` (ADR-011). Los routers solo traducen HTTP; las reglas y la bitácora están en el servicio.

| # | Módulo | Rutas `/api/v1` | Tablas | Requisitos |
| ---: | :--- | :--- | :--- | :--- |
| 1 | `auth` | `/auth/*` (11) | `users`, `sessions`, `auth_tokens`, `rate_limits` | RF-01, RNF-02 |
| 2 | `users` | `/users*` (5) | `users` | RF-11 |
| 3 | `roles` | `/roles*` (2) | `roles`, `permissions`, `role_permissions` | RF-11 |
| 4 | `audit` | `/audit` (1) | `audit_logs` | RF-17 |
| 5 | `patients` | `/patients*` (6) y contactos (4) | `patients`, `patient_contacts` | RF-02, RNF-06 |
| 6 | `evaluations` | `/patients/{id}/evaluations*` (4) | `patient_evaluations` | RF-02, RNF-06 |
| 7 | `documents` | `/patients/{id}/documents*` (4) | `patient_documents` + bucket privado | RF-02, RNF-06 |
| 8 | `schedules` | `/schedules*` (8), `/public/schedules` | `schedules` | RF-04, RF-10 |
| 9 | `attendance` | `/schedules/{id}/attendance*` (6), `/attendance/monthly` | `attendance` | RF-12 |
| 10 | `inventory` | `/inventory*` (9) | `inventory_items`, `inventory_movements` | RF-03, RF-09, RF-13 |
| 11 | `donations` | `/donations*` (8), `/public/donations/*` (3) | `donations`, `donation_goals`, `donation_goal_milestones` | RF-06, RF-14, RF-15 |
| 12 | `media` | `/media/*` (11), `/public/media/*` (2) | `media_albums`, `media_assets`, `media_patient_tags` | RF-05, RNF-10 |
| 13 | `institutional` | `/content/*` (5), `/public/content*` (2) | `institutional_sections` | RF-07, RF-08 |
| 14 | `inquiries` | `/inquiries*` (7), `/public/inquiries` | `inquiries`, `inquiry_notes` | RF-16 |
| 15 | `dashboard` | `/dashboard/summary` | (lee de los demás) | Panel de inicio |
| 16 | `system` | `/health`, `/health/db` | — | RNF-04 (monitoreo) |

En total, **104 operaciones** publicadas en [`openapi.json`](../api/openapi.json). `system` está en `app/main.py` porque no tiene reglas de negocio.

**Núcleo común (`app/core/`):** configuración y validaciones de producción, `DbSession` (una transacción por petición, con `after_commit`), errores de dominio, paginación, límites de intentos, reloj de Bolivia, exportación CSV/Excel segura y cabeceras de seguridad.

**Adaptadores (`app/adapters/`):** Supabase Storage, Cloudinary, correo (Resend, Brevo o consola), Google y Turnstile. Las pruebas los reemplazan por dobles, así ninguna prueba llama a internet.

## 4. Contrato de datos: OpenAPI → TypeScript

El contrato ya no se describe a mano ni se compara con `src/types/aspar.ts`. La fuente de verdad es el esquema OpenAPI que genera la propia API (ADR-013):

```text
Backend (Pydantic, camelCase)
   └─ python -m scripts.export_openapi ──► docs/api/openapi.json
                                              └─ npm run api:types ──► Frontend/src/api/schema.d.ts
                                                                          └─ src/api/types.ts y endpoints.ts
```

| Verificación | Dónde | Qué falla |
| :--- | :--- | :--- |
| `python -m scripts.export_openapi --check` | CI Backend | Un cambio de la API sin regenerar `openapi.json` |
| `npm run api:types:check` | CI Frontend | `schema.d.ts` desactualizado respecto de `openapi.json` |
| `vue-tsc` (en el build) | CI Frontend | Código que usa un campo que ya no existe o con otro tipo |
| `endpoints.spec.ts` | CI Frontend | Una operación de `openapi.json` sin método en `src/api/endpoints.ts` |
| `test_openapi.py` | CI Backend | Rutas, etiquetas o esquemas inválidos en la especificación |

- **Formato:** JSON en camelCase en todas las rutas (`CamelModel`). Fechas ISO 8601; montos en bolivianos como número.
- **Errores:** siempre `{"detail": "<mensaje en español>"}`. El frontend lo muestra tal cual (`ApiError.message`).
- **Listados:** sobre paginado `{items, total, limit, offset}` con `?limit=` (1 a 200, por defecto 50) y `?offset=`.
- **Archivos:** `GET /inventory/export` y `GET /donations/summary?format=csv|xlsx` devuelven el archivo con `Content-Disposition: attachment`. El frontend los pide con `blob: true`.

**Capa del frontend (`Frontend/src/api/`):**

| Archivo | Contenido |
| :--- | :--- |
| `client.ts` | `HttpClient`: `credentials: 'include'`, CSRF automático, `ApiError`, descarga de archivos |
| `endpoints.ts` | Un método por operación (`api.patients.list`, `api.donations.downloadSummary`…) |
| `session.ts` | Estado de la sesión, `can` / `canAny`, renovación y vencimiento ante un 401 |
| `types.ts` | Alias legibles de los tipos generados (`PatientOut`, `PatientSummaryOut`…) |
| `schema.d.ts` | Generado. No se edita a mano |

Todas las vistas usan `src/api/`. El modo demo (`src/services/`, ADR-008) se retiró en el Sprint 2 (F5b y F6), sin cambiar el contrato.

## 5. Base de datos

- **Motor:** PostgreSQL en Supabase, solo accesible desde el Backend (ADR-007). RLS activo **sin políticas** en todas las tablas y sin permisos para `anon` ni `authenticated`: la `anon key` de Supabase no expone nada.
- **Usuarios:** la API usa `aspar_api` (lee y escribe datos, no cambia el esquema); las migraciones usan el dueño del esquema; el respaldo usa `aspar_backup` (solo lectura). Ver la [guía de despliegue](../despliegue/GUIA_DE_DESPLIEGUE.md).
- **Migraciones versionadas** (`python -m scripts.migrate`): toman un bloqueo, guardan el SHA-256 de cada archivo en `schema_migrations` y se detienen si una migración aplicada cambió. Nunca se edita una migración aplicada: cada cambio es un archivo nuevo.

| Migración | Contenido |
| :--- | :--- |
| `001_base.sql` | 25 tablas, reglas `CHECK`, triggers (bitácora inmutable, rol del sistema), roles, permisos y secciones iniciales |
| `002_busqueda_trigram.sql` | `pg_trgm` e índices de búsqueda parcial |
| `003_referencia_bancaria_unica.sql` | Una referencia del extracto confirma un solo aporte |
| `004_evaluaciones_quitadas.sql` | Una evaluación registrada por error se quita con su motivo y se conserva |

**Concurrencia:** las reglas de unicidad están en la base. Si dos personas hacen lo mismo a la vez (registrar la misma CI, confirmar dos aportes con la misma referencia, subir el mismo archivo), la segunda recibe **409** con un mensaje claro; nunca un 500.
