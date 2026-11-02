# Matriz de trazabilidad: requisitos, módulos, endpoints y pruebas (SCRUM-136 / SCRUM-181)

Esta matriz une cada requisito funcional (**RF-01 a RF-17**) y no funcional (**RNF-01 a RNF-11**) con:

- su historia y subtareas de Jira;
- el módulo del Backend que lo implementa;
- sus endpoints;
- las pruebas automáticas que lo verifican.

Refleja el estado al **cerrar el Backend del Sprint 2** y al terminar los **bloques F1 y F2 del Frontend** (diseño base, sesión real y acceso; afiliados). Los requisitos RF-11 a RF-17 y RNF-06 a RNF-11 están definidos en la [adenda del SRS](../srs/SRS_ADENDA_SPRINT1.md).

| Suite | Pruebas | Cobertura | Dónde corre |
| :--- | ---: | :--- | :--- |
| Backend (pytest, PostgreSQL real) | **433** en 32 archivos | 98 % de sentencias (mínimo 70 %) | `.github/workflows/ci-backend.yml` |
| Frontend (Vitest) | **247** en 23 archivos | 93,97 % de líneas (mínimo 70 %) | `.github/workflows/ci-frontend.yml` |
| Frontend E2E (Playwright, API real de Docker) | **41** recorridos en 6 archivos | — | `npm run e2e` (local, con `docker compose`) |

**Columnas:**

- **Subtareas F / B / V:** subtareas de Frontend, Backend y verificación de cada historia en Jira (`SCRUM-n`).
- **Módulo:** carpeta `Backend/app/modules/<módulo>/` ([diagrama C3](../arquitectura/C4_Y_MODELO_ER_ACTUALIZADO.md#4-nivel-c3--componentes-de-la-api)).
- **Pruebas:** archivo y número de pruebas. Las del Backend están en `Backend/tests/`; las del Frontend, en `Frontend/src/**/__test__/` (Vitest) y `Frontend/e2e/` (Playwright).

**Estado:**

- **API:** ✅ implementado y probado · ⚠️ implementado con pendientes · ❔ sin verificar.
- **Pantalla:** ✅ conectada a la API · 🎨 existe en modo demo y falta la migración visual a `src/api/` · ⏳ sin pantalla aún.

## 1. Requisitos funcionales

| Req. | Historia | Subtareas F / B / V | Módulo | Endpoints `/api/v1` | Pruebas Backend | Pruebas Frontend | API | Pantalla |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- | :---: | :---: |
| **RF-01** Acceso del personal | SCRUM-11 | 66 / 26, 27 / 28 | `auth` | `POST /auth/login`, `/auth/google`, `/auth/register`, `/auth/verify-email`, `/auth/resend-verification`, `/auth/forgot-password`, `/auth/reset-password`, `/auth/change-password` | `test_auth_login.py` (9), `test_auth_credentials.py` (10), `test_accounts.py` (21), `test_security.py` (6), `test_adapters.py` (10) | `__test__/acceso.spec.ts` (22), `__test__/cuentas.spec.ts` (16), `components/widgetsExternos.spec.ts` (8), `api/session.spec.ts` (10) · E2E `acceso.spec.ts` (7), `cuentas.spec.ts` (5), `pantallas-de-acceso.spec.ts` (11) | ✅ | ✅ |
| **RF-02** Fichas y anamnesis | SCRUM-13 | 68 / 31, 32 / 69 | `patients`, `evaluations`, `documents` | `GET/POST /patients` (pestañas, actividad y orden), `GET /patients/summary`, `GET/PATCH /patients/{id}`, `…/deactivate`, `…/reactivate` (con motivo), `…/attendance`, `…/contacts*`, `…/evaluations*` (con quitar por error), `…/documents*` | `test_patients_api.py` (16), `test_patients_listing.py` (17), `test_patient_model.py` (12), `test_contacts_evaluations.py` (18) | `__test__/afiliados.spec.ts` (27), `__test__/fichaAfiliado.spec.ts` (47), `utils/patients.spec.ts` (15) · E2E `afiliados.spec.ts` (5), `ficha-afiliado.spec.ts` (6), `pantallas-completas.spec.ts` (7) | ✅ | ✅ (F2) |
| **RF-03 / RF-09 / RF-13** Inventario, reporte y movimientos | SCRUM-136, SCRUM-131 | 183 · 167 / 166 / 168 | `inventory` | `GET/POST /inventory`, `GET/PATCH /inventory/{id}`, `…/deactivate`, `GET/POST …/movements`, `GET /inventory/summary`, `GET /inventory/export` (CSV/Excel) | `test_inventory.py` (15) | `PantallasRequisitos.spec.ts` | ✅ | 🎨 |
| **RF-04 / RF-10** Actividades y agenda pública | SCRUM-16, SCRUM-19 | 74, 43 / 37, 76 / 38, 44 | `schedules` | `GET/POST /schedules`, `GET/PATCH/DELETE /schedules/{id}`, `…/publish`, `…/unpublish`, `…/cancel`, `GET /public/schedules` | `test_schedules.py` (17) | `ScheduleManagementView.spec.ts` (6) | ✅ | 🎨 |
| **RF-05** Galería multimedia | SCRUM-136 | 183 / — / — | `media` | `/media/albums*` (9), `DELETE /media/assets/{id}`, `PUT …/tags`, `GET /public/media/albums*` | `test_media.py` (31) | — | ✅ | 🎨 |
| **RF-06 / RF-14** Donaciones por canal y resumen mensual | SCRUM-136, SCRUM-132 | 183 · 170 / 169 / 171 | `donations` | `GET/POST /donations`, `GET /donations/{id}`, `…/confirm`, `…/cancel`, `GET /donations/summary?format=json\|csv\|xlsx`, `POST /public/donations/notice` | `test_donations.py` (29) | `PantallasRequisitos.spec.ts` | ✅ | 🎨 |
| **RF-15** Meta pública de recaudación | SCRUM-133 | 173 / 172 / 174 | `donations` | `GET/PUT /donations/goal`, `GET /public/donations/goal` | `test_donations.py` (incluido arriba) | — | ✅ | 🎨 |
| **RF-07 / RF-08** Contenido institucional y redes | SCRUM-136 | 183 / — / — | `institutional` | `GET /content/sections*`, `PUT …/{key}`, `POST …/{key}/publish`, `PUT /content/social-links`, `GET /public/content*` | `test_content.py` (15) | `PantallasRequisitos.spec.ts` | ✅ | 🎨 |
| **RF-11** Equipo, roles y permisos | SCRUM-129 | 161 / 160 / 162 | `users`, `roles` | `GET/POST /users`, `PATCH /users/{id}`, `…/approve`, `…/reset-password`, `GET /roles`, `PUT /roles/{key}/permissions` | `test_users_api.py` (11), `test_roles.py` (14), `test_permissions.py` (11) | `UsersView.spec.ts` (8), `router/guards.spec.ts` (8) · E2E: persona invitada y cuenta pendiente | ✅ | 🎨 Contraseña temporal y cuenta pendiente ✅ (F1); gestión del equipo en F3 |
| **RF-12** Asistencia | SCRUM-130 | 164 / 163 / 165 | `attendance` | `GET /schedules/{id}/attendance`, `PUT …/{patientId}`, `…/mark-all-present`, `…/newcomers`, `…/close`, `…/reopen`, `GET /attendance/monthly` | `test_attendance.py` (25), `test_patients_listing.py` (sábados del trimestre e historial) | `PantallasRequisitos.spec.ts` (bloqueo RNF-06), `fichaAfiliado.spec.ts` (pestaña Asistencia) | ✅ | 🎨 Asistencia de cada ficha ✅ (F2); toma de asistencia en F4 |
| **RF-16** Contacto y preinscripciones | SCRUM-134 | 176 / 175 / 177 | `inquiries` | `POST /public/inquiries` (Turnstile y límite por IP), `GET /inquiries*`, `PATCH /inquiries/{id}`, `…/notes`, `…/patient-draft`, `…/convert-to-patient` | `test_inquiries.py` (21) | — | ✅ | ⏳ |
| **RF-17** Bitácora de auditoría | SCRUM-135 | 179 / 178 / 180 | `audit` | `GET /audit` (área, persona o afiliado, días, situaciones para revisar), `GET /audit/summary`, `GET /audit/export` | `test_audit.py` (8), `test_audit_activity.py` (8) | `AuditView.spec.ts` (3) | ✅ | 🎨 |
| Panel de inicio | — | — | `dashboard` | `GET /dashboard/summary` | `test_dashboard.py` (5) | — | ✅ | ⏳ |

**Qué cubre cada archivo de pruebas del Backend** (resumen):

- `test_accounts.py`: registro, verificación, recuperación, contraseña temporal y Google (vincular, bloquear, crear cuenta pendiente).
- `test_inventory.py`: stock nunca negativo, movimientos, baja con motivo y exportación protegida contra fórmulas.
- `test_schedules.py`: borrador, publicación y cancelación con aviso, horarios y cupos.
- `test_attendance.py`: lista, marcado, cierre y reapertura, recién llegados y resumen mensual.
- `test_media.py`: firma de subida, publicación solo con revisión y sin personas etiquetadas sin consentimiento de imagen, y borrado en Cloudinary solo después del commit.
- `test_donations.py`: conciliación con el extracto, referencia bancaria única (migración 003), meta sin datos de donantes y exportación CSV/Excel.
- `test_content.py`: borrador y publicación de secciones.
- `test_inquiries.py`: formulario público, seguimiento e inscripción como afiliado.

## 2. Requisitos no funcionales

| Req. | Historia | Subtareas F / B / V | Dónde se cumple | Pruebas y verificación | Estado |
| :--- | :--- | :--- | :--- | :--- | :---: |
| **RNF-01** Rendimiento (< 3 s con 50 usuarios) | — | — | Paginación en todos los listados, índices `pg_trgm` | Falta una prueba de carga en staging | ❔ |
| **RNF-02** Contraseñas y sesiones | SCRUM-12 | 67 / 29 / 30 | `auth`, `core/security`, tabla `sessions`, cookies HttpOnly + CSRF | `test_sessions.py` (9), `test_hardening.py` (11), `test_security.py`, `test_auth_login.py` · `api/client.spec.ts` (14), `composables/useIdleSession.spec.ts` (7, aviso a los 13 min, renovación y cierre a los 15), `components/ui.spec.ts` (aviso «¿Sigues ahí?») · E2E: inactividad con el reloj del navegador | ✅ |
| **RNF-03** Accesibilidad WCAG 2.1 AA | — | — | Pantallas del Frontend | Base desde F1: foco visible, modal con foco atrapado, avisos con `role=alert/status`, etiqueta en cada campo, «Saltar al contenido» e insignias legibles por lector de pantalla (`components/ui.spec.ts`). Falta la revisión completa en F6 | ❔ |
| **RNF-04** Disponibilidad 99,5 % | — | — | Cloud Run + Supabase (ADR-014), `GET /health` y `/health/db` | `test_health.py` (2) · la medición empieza con el primer despliegue | ❔ |
| **RNF-05** Cobertura ≥ 70 % | SCRUM-61 | 96 / 95 / 97 | CI con `--cov-fail-under=70` y umbral de Vitest | Backend 98 %, Frontend 93,97 % de líneas | ✅ |
| **RNF-06** Privacidad clínica | SCRUM-123 | 138 / 137 / 139 | `patients.can_view_clinical_record` (permiso + consentimiento + acceso Activo), `PatientSummaryOut` sin anamnesis, `evaluations`, `documents`, bucket privado, `CHECK` en la base | `test_patient_privacy.py` (20), `test_contacts_evaluations.py`, `test_storage_adapter.py` (3), `test_media.py` (consentimiento de imagen) · `fichaAfiliado.spec.ts` (aviso con el motivo real: rol, consentimiento, acceso suspendido o pendiente; sin acceso no se piden evaluaciones ni documentos), `router/guards.spec.ts` · E2E: Voluntariado ve «Información protegida» y Recepción sube documentos sin verlos | ✅ |
| **RNF-07** Respaldo y recuperación | SCRUM-124 | ver adenda §1.1 | `scripts/backup_db.py` (pg_dump + documentos, cifrado RSA-4096 + Fernet) y `.github/workflows/backup.yml` | `test_backup.py` (9): cifrado de ida y vuelta, clave equivocada, archivo alterado, la contraseña no queda en los argumentos, `pg_restore --list` real. Restauración completa probada en una base nueva | ⚠️ El workflow corre a mano; el cron diario se activa al cargar los secretos de producción. Falta medir RPO/RTO en staging |
| **RNF-08** Navegadores y pantallas | SCRUM-125 | ver adenda §1.1 | Frontend | Diseño adaptable desde 360 px (menú del equipo como panel en el celular, probado en el E2E con 390 px). Las pantallas de acceso entran sin barra de desplazamiento de 1366×680 a 1920×900 (`pantallas-de-acceso.spec.ts`). El listado y la ficha de afiliados tienen una sola barra a 1366×768 y 1920×1080, sin desplazamiento lateral (las tablas pasan a tarjetas según su ancho). En escritorio cada pantalla entra completa en la ventana, sin barra de desplazamiento, a 1366×768, 1280×720 y 1920×1080; en el celular la página se desplaza con las pestañas fijas (`pantallas-completas.spec.ts`). Falta probar Firefox, Edge y Safari en F6 | ❔ |
| **RNF-09** Usabilidad y manual | SCRUM-126 | ver adenda §1.1 | — | Prueba con ASPAR y manual pendientes | ❔ |
| **RNF-10** Galería en Cloudinary | SCRUM-127 | ver adenda §1.1 | `media` + `adapters/cloudinary.py`: subida firmada con formatos permitidos y carpeta por álbum; al borrar, el archivo se elimina también en Cloudinary | `test_media.py` (31) | ⚠️ Falta el procedimiento de monitoreo de cuota y contingencia |
| **RNF-11** Mantenibilidad | SCRUM-128 | 153 / 152 / 154 | Módulos por dominio (ADR-011), migraciones versionadas, contrato OpenAPI → TypeScript (ADR-013), Ruff, ESLint, Prettier, Dependabot, `pip-audit`, `npm audit` | `test_migrations.py` (11), `test_openapi.py` (2), `test_scripts.py` (10), `test_core.py` (26), `test_pagination.py` (9) · `api/endpoints.spec.ts` (4, todas las operaciones de `openapi.json` cubiertas), `api/index.spec.ts` (1), `npm run api:types:check` | ✅ |

**Conteo completo del Backend (433):** media 31 · donations 29 · core 26 · attendance 25 · inquiries 21 · accounts 21 · patient_privacy 20 · schedules 17 · patients_listing 17 · contacts_evaluations 18 · patients_api 16 · inventory 15 · content 15 · roles 14 · patient_model 12 · users_api 11 · permissions 11 · migrations 11 · hardening 11 · scripts 10 · auth_credentials 10 · adapters 10 · sessions 9 · pagination 9 · backup 9 · auth_login 9 · audit 8 · security 6 · dashboard 5 · storage_adapter 3 · openapi 2 · health 2.

**Conteo completo del Frontend (247):** fichaAfiliado 47 · afiliados 27 · acceso 23 · cuentas 16 · ui 15 · utils/patients 15 · api/client 14 · api/session 10 · PantallasRequisitos 10 · widgetsExternos 8 · guards 8 · UsersView 8 · useIdleSession 7 · format 7 · ScheduleManagementView 6 · stickyHeader 5 · validation 5 · api/endpoints 4 · useToast 4 · AuditView 3 · useFitLayout 2 · router/scroll 2 · api/index 1.

**Recorridos E2E de F1 (23):** `e2e/pantallas-de-acceso.spec.ts` (11: el ingreso entra completo y sin barra de desplazamiento en 5 tamaños de pantalla, con error, recuperación, cuenta pendiente, cambio de contraseña, crear cuenta con desplazamiento solo en el formulario y celular), `e2e/acceso.spec.ts` (7: ingreso fallido, Administración, Voluntariado, cuenta pendiente, persona invitada con contraseña temporal, inactividad, menú en el celular) y `e2e/cuentas.spec.ts` (5: registro y reenvío de confirmación, enlace vencido, recuperación, enlace de recuperación inválido, Google). Evidencia: [`EVIDENCIAS_FRONTEND_F1.md`](../evidencias/EVIDENCIAS_FRONTEND_F1.md).

**Recorridos E2E de F2 (11):** `e2e/afiliados.spec.ts` (5: pestañas con los contadores de la API, búsqueda por carnet, páginas, orden y filtro; alta con carnet repetido; Voluntariado sin alta; una sola barra a 1366×768 y 1920×1080) y `e2e/ficha-afiliado.spec.ts` (6: datos, familiares, historia clínica, evaluaciones, asistencia y documentos; baja y reactivación con motivo; una sola barra en las cinco pestañas a 1366×768 y 1920×1080; privacidad del Voluntariado; Recepción sube documentos sin verlos). Evidencia: [`EVIDENCIAS_FRONTEND_F2.md`](../evidencias/EVIDENCIAS_FRONTEND_F2.md).

**Ajuste de F2 (7):** `e2e/pantallas-completas.spec.ts` (Resumen, listado y las cinco pestañas de la ficha a 1366×768, 1280×720 y 1920×1080 sin barra de desplazamiento; el listado muestra las filas que caben; en el celular las pestañas quedan fijas). `ficha-afiliado.spec.ts` además quita una evaluación con su motivo.

## 3. Tareas técnicas y su evidencia

| Tarea | Subtareas F / B / V | Evidencia vigente |
| :--- | :--- | :--- |
| SCRUM-57 Aceptación y evidencias | 85 / 84 / 83 | `docs/evidencias/` (Sprint 1), esta matriz y el CI del Sprint 2 |
| SCRUM-58 Integración Frontend–Backend | 87 / 86 / 88 | [`CONTRATO_API_LOGIN_PACIENTES.md`](../api/CONTRATO_API_LOGIN_PACIENTES.md), `Frontend/src/api/`, `openapi.json` |
| SCRUM-59 README y `.env.example` | 91 / 90 / 89 | `README.md`, `Frontend/README.md`, `Backend/README.md`, `*/.env.example` |
| SCRUM-61 CI/CD | 96 / 95 / 97 | `.github/workflows/` (CI, respaldo), `.github/dependabot.yml`, [ADR-014](../arquitectura/adr/ADR-014-despliegue-y-operacion.md) |
| SCRUM-64 C4, datos y migraciones | 105 / 104 / 106 | [`C4_Y_MODELO_ER_ACTUALIZADO.md`](../arquitectura/C4_Y_MODELO_ER_ACTUALIZADO.md), [`MODELO_DATOS_Y_CONTRATOS.md`](../arquitectura/MODELO_DATOS_Y_CONTRATOS.md), `docs/arquitectura/adr/`, `Backend/migrations/` |
| SCRUM-65 Flujo de Git | 108 / 107 / 109 | `docs/git/FLUJO_GIT_Y_PULL_REQUESTS.md` |
| SCRUM-136 Trazabilidad | 183 / 182 / 181 | Esta matriz |
| SCRUM-190 BPMN 2.0 | 194 / 193 / 192 | `docs/bpmn/` |
| SCRUM-191 Wireframes | 195 / 197 / 196 | `docs/wireframes/WIREFRAMES_Y_FLUJOS_ASPAR.md` |

## 4. Qué cambió desde el Sprint 1

| Tema | Sprint 1 | Cierre del Backend (Sprint 2) |
| :--- | :--- | :--- |
| Módulos | 5 routers (auth, patients, documents, users, audit) | 16 módulos de dominio, 104 operaciones |
| Base de datos | 12 tablas, 2 migraciones | 25 tablas, migraciones 001 a 004 |
| Sesión | JWT en `Authorization: Bearer` guardado por el frontend | Cookie HttpOnly + token CSRF; validez decidida en `sessions` |
| Roles | 5 roles fijos en un `CHECK` | Roles y 17 permisos en la base, editables por Administración |
| Acceso | Solo correo y contraseña | Contraseña o Google, registro con verificación y aprobación, Turnstile |
| RNF-06 | Anamnesis oculta según el rol | Permiso + consentimiento + acceso Activo; el listado nunca lleva datos clínicos |
| Contrato | `test_contract_frontend.py` comparaba con `src/types/aspar.ts` | OpenAPI → `schema.d.ts` generado, verificado en los dos CI |
| Pruebas | 103 Backend y 65 Frontend (medición de cierre) | 412 Backend y 107 Frontend |
| Respaldos | Sin definir | Respaldo cifrado con script y workflow, restauración probada |

La versión anterior de esta matriz, con el detalle por pantalla del Sprint 1, queda en el historial de Git y en [`docs/evidencias/`](../evidencias/EVIDENCIAS_SPRINT1.md).

## 5. Pendiente

- **Migración visual:** F1 ya conectó el acceso y el espacio del equipo (RF-01, RNF-02) y F2, los afiliados (RF-02, RNF-06). Faltan F3 (equipo y registro de actividad), F4 (actividades, asistencia e inventario), F5a y F5b (donaciones, galería, contenido y sitio público) y F6 (solicitudes, panel y retiro del modo demo). La API de cada una ya está probada.
- **Verificar en staging (F1):** «Continuar con Google» con un ID de cliente real y Turnstile con la clave real de Cloudflare. En local se probaron con dobles y la API respondió de verdad.
- **Verificar en staging (F2):** subir, abrir y quitar documentos con el bucket privado real de Supabase (en local la API responde que el almacenamiento no está configurado).
- **Verificar en staging:** RNF-01 (carga), RNF-04 (disponibilidad), RNF-07 (RPO/RTO) y la cuota de RNF-10.
- **Con la migración visual:** RNF-03 (accesibilidad), RNF-08 (navegadores) y RNF-09 (usabilidad y manual).
