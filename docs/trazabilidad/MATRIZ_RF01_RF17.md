# Matriz de Trazabilidad Completa de Requisitos, Pantallas y Pruebas (SCRUM-136 / SCRUM-183)

Esta matriz alinea los requisitos funcionales y no funcionales (**RF01–RF17** y **RNF01–RNF11**) con las pantallas implementadas en el Frontend Vue 3, los endpoints del Backend FastAPI y los casos de prueba verificados.

> **Versión vigente:** la sección [Trazabilidad integral](#trazabilidad-integral-rfrnf--jira--c4--pruebas-scrum-136--scrum-181) une requisito, historia y subtareas de Jira, contenedor y componente C4, pantalla, endpoint y pruebas. Las tablas siguientes se conservan como registro de cada etapa del sprint. Los requisitos RF-11, RF-17, RNF-06 y RNF-11 se definen en la [adenda del SRS](../srs/SRS_ADENDA_SPRINT1.md).

## Trazabilidad integral: RF/RNF → Jira → C4 → pruebas (SCRUM-136 / SCRUM-181)

**Columnas Jira:** subtareas de Frontend (F), Backend (B) y verificación (V) de cada historia. **C4:** contenedor del C2 → componente del C3 ([diagramas vigentes](../arquitectura/C4_Y_MODELO_ER_ACTUALIZADO.md)). **E2E:** paso del [recorrido integrado](../evidencias/RECORRIDO_INTEGRADO_LOGIN_PACIENTES.md).
**Estado:** ✅ implementado y probado · ⚠️ implementado con pendientes · ⏳ planificado para el Sprint 2 · ❔ sin verificar

| Req. | Historia | Subtareas F / B / V | Contenedor → componente C4 | Pantalla | Endpoint `/api/v1` | Pruebas Frontend | Pruebas Backend | E2E | Estado |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| **RF-01** | SCRUM-11 | 66 / 26, 27 / 28 | SPA → `LoginView` · API → `routers/auth`, `auth_service`, `core/security` | `LoginView.vue` | `POST /auth/login` | `LoginView.spec.ts` (validaciones, intento fallido, 423, API caída) | `test_auth_login.py`, `test_auth_credentials.py`, `test_security.py` | 1, 7, 8 | ✅ |
| **RNF-02** | SCRUM-12 | 67 / 29 / 30 | SPA → `App.vue` · API → `core/deps` (JWT + `sessions`) | `App.vue` | `GET /auth/verify`, `POST /auth/refresh`, `POST /auth/logout` | `LoginView.spec.ts` (renovación local y con API, cierre) | `test_sessions.py`, `test_security.py` | 9 | ✅ · `App.vue` sin prueba de componente |
| **RF-02** | SCRUM-13 | 68 / 31, 32 / 69 | SPA → `PatientsView`, `RegisterPatientView` · API → `routers/patients`, `patient_service` | `PatientsView.vue`, `RegisterPatientView.vue` | `GET/POST /patients`, `GET/PATCH/DELETE /patients/{id}` | `PatientsView.spec.ts`, `PantallasRequisitos.spec.ts` | `test_patients_api.py`, `test_patient_model.py` | 2, 3, 4 | ⚠️ Falta pantalla para editar la ficha |
| **RNF-06** | SCRUM-123 | 138 / 137 / 139 | API → `patient_service.can_view_clinical_record`, `document_service`, `adapters/storage` · BD → `CHECK` de consentimiento | `PatientsView.vue`, `AttendanceView.vue` | `GET /patients*`, `/patients/{id}/documents*` | `PatientsView.spec.ts`, `PantallasRequisitos.spec.ts`, `RouterPermisos.spec.ts` | `test_patient_privacy.py`, `test_storage_adapter.py` | 5, 6 | ⚠️ La pantalla muestra campos clínicos a Recepción |
| **RF-11** | SCRUM-129 | 161 / 160 / 162 | SPA → `UsersView`, guardia `adminOnly` · API → `routers/users`, `user_service`, `require_roles` | `UsersView.vue` | `GET/POST /users`, `PATCH /users/{id}`, `POST /users/{id}/reset-password` | `UsersView.spec.ts`, `RouterPermisos.spec.ts` | `test_users_api.py` | — | ⚠️ La pantalla no muestra la contraseña temporal |
| **RF-17** | SCRUM-135 | 179 / 178 / 180 | SPA → `AuditView` · API → `routers/audit`, `audit_service` · BD → trigger de inmutabilidad | `AuditView.vue` | `GET /audit` | `AuditView.spec.ts`, `RouterPermisos.spec.ts` | `test_audit.py` | — | ✅ |
| **RNF-11** | SCRUM-128 | 153 / 152 / 154 | CI → `ci-frontend.yml`, `ci-backend.yml` | — | — | ESLint, Prettier, `vue-tsc` | Ruff, `test_migrations.py`, `test_openapi.py`, `test_contract_frontend.py` | — | ✅ |
| **RNF-05** | SCRUM-61 | 96 / 95 / 97 | CI → cobertura con mínimo de 70% | — | — | Vitest: 80,30% de líneas | pytest: 96,94% | — | ✅ |
| **RF-03 / RF-09** | SCRUM-136 | 183 / — / — | SPA → `InventoryView` · BD → `inventory_items` | `InventoryView.vue` | ⏳ | `PantallasRequisitos.spec.ts` (registro, filtro, CSV) | `test_migrations.py` (esquema) | — | ⏳ Sin «dar de baja» ni PDF; datos solo locales |
| **RF-04 / RF-10** | SCRUM-136 | 183 / — / — | SPA → `ScheduleView` · BD → `schedules` | `ScheduleView.vue` (`/`) | ⏳ | `PantallasRequisitos.spec.ts` (portal) | `test_migrations.py` | — | ⏳ Cronograma sin edición |
| **RF-05** | SCRUM-136 | 183 / — / — | SPA → `ScheduleView` · API → `adapters/storage` · BD → `media_assets` | `ScheduleView.vue` | ⏳ | — | `test_storage_adapter.py` | — | ⏳ Carga visible al público |
| **RF-06** | SCRUM-136 | 183 / — / — | SPA → `ScheduleView` · BD → `donations` | `ScheduleView.vue` | ⏳ | `PantallasRequisitos.spec.ts` (donación QR) | `test_migrations.py` | — | ⏳ Libélula simulada |
| **RF-07 / RF-08** | SCRUM-136 | 183 / — / — | SPA → `ScheduleView` · BD → `institutional_info` | `ScheduleView.vue` | ⏳ | `PantallasRequisitos.spec.ts` (redes y requisitos) | `test_migrations.py` | — | ⏳ Contenido sin edición |
| **RF-12 a RF-16** | Por confirmar en Jira | — | SPA → `AttendanceView` · BD → `attendance` | `AttendanceView.vue` | ⏳ | `PantallasRequisitos.spec.ts` (bloqueo RNF-06) | `test_migrations.py` | — | ❔ Definición pendiente en el SRS |
| **RNF-01, RNF-03, RNF-04** | — | — | — | — | — | — | — | — | ❔ Sin verificar (ver adenda §3) |

### Tareas técnicas del Sprint 1 y su evidencia

| Tarea | Subtareas F / B / V | Evidencia |
| :--- | :--- | :--- |
| SCRUM-57 Aceptación y evidencias | 85 / 84 / 83 | `docs/evidencias/`, `docs/calidad/DEFINICION_DE_HECHO_Y_ESTADO_SPRINT1.md` |
| SCRUM-58 Integración login y pacientes | 87 / 86 / 88 | `docs/api/CONTRATO_API_LOGIN_PACIENTES.md`, `docs/evidencias/RECORRIDO_INTEGRADO_LOGIN_PACIENTES.md` |
| SCRUM-59 README y `.env.example` | 91 / 90 / 89 | `README.md`, `Frontend/README.md`, `Backend/README.md`, `*/.env.example` |
| SCRUM-61 CI/CD | 96 / 95 / 97 | `.github/workflows/`, `docs/evidencias/EVIDENCIAS_CI_Y_COBERTURA_SPRINT1.md` |
| SCRUM-64 C4, datos y migraciones | 105 / 104 / 106 | `docs/arquitectura/C4_Y_MODELO_ER_ACTUALIZADO.md`, `docs/arquitectura/adr/`, `Backend/migrations/` |
| SCRUM-65 Flujo de Git | 108 / 107 / 109 | `docs/git/FLUJO_GIT_Y_PULL_REQUESTS.md` |
| SCRUM-136 Trazabilidad | 183 / 182 / 181 | Esta matriz |
| SCRUM-190 BPMN 2.0 | 194 / 193 / 192 | `docs/bpmn/` |
| SCRUM-191 Wireframes | 195 / 197 / 196 | `docs/wireframes/WIREFRAMES_Y_FLUJOS_ASPAR.md` |

## Registro inicial del Frontend (SCRUM-136 / SCRUM-183)

| ID Req. | Historia / Subtarea Jira | Descripción del Requisito | Pantalla / Componente Frontend | Endpoint Backend / Servicio | Estado |
| :--- | :--- | :--- | :--- | :--- | :--- |
| **RF-01** | SCRUM-11 / SCRUM-66 | Inicio de sesión administrativo con validaciones y bloqueo por intentos fallidos | `src/views/LoginView.vue` | `POST /api/v1/auth/login` (`signInWithApi`) | Implementado y probado |
| **RF-02** | SCRUM-13 / SCRUM-68 | Fichas de pacientes y anamnesis digital (física, fonoaudiología, psicología) | `src/views/PatientsView.vue`, `src/views/RegisterPatientView.vue` | `GET/POST/PATCH /api/v1/patients` | Implementado y probado |
| **RF-03** | SCRUM-183 | Gestión de inventario (Propio, Donación, Préstamo Alcaldía) | `src/views/InventoryView.vue` | `getInventory`, `saveInventoryItem` | Implementado y probado |
| **RF-04** | SCRUM-183 | Publicación y gestión del cronograma de actividades sabatinas | `src/views/ScheduleView.vue` | `schedule` / `AttendanceView.vue` | Implementado y probado |
| **RF-05** | SCRUM-183 | Gestión de galería multimedia en Cloud Storage (S3/Cloudinary) | `src/views/ScheduleView.vue` (Sección Multimedia) | `getMediaAssets`, `addMediaAsset` | Implementado y probado |
| **RF-06** | SCRUM-183 | Módulo de donaciones con QR bancario oficial y pasarela Libélula | `src/views/ScheduleView.vue` (Sección Donaciones) | `getDonations`, `registerDonation` | Implementado y probado |
| **RF-07** | SCRUM-183 | Contenido institucional (misión, modelo CETRAM, requisitos de inscripción) | `src/views/ScheduleView.vue` | `institutionalInfo` | Implementado y probado |
| **RF-08** | SCRUM-183 | Enlaces directos a redes sociales oficiales (Facebook, Instagram, TikTok) | `src/views/ScheduleView.vue` (Hero Social Links) | `institutionalInfo.socialLinks` | Implementado y probado |
| **RF-09** | SCRUM-183 | Exportación de reportes de inventario en CSV/PDF para la Alcaldía | `src/views/InventoryView.vue` (`exportReport`) | Exportador CSV/Acta PDF | Implementado y probado |
| **RF-10** | SCRUM-183 | Visualización pública del cronograma sabatino sin requerir login | `src/views/ScheduleView.vue` (Ruta pública `/`) | `schedule` | Implementado y probado |
| **RF-11** | SCRUM-129 / SCRUM-161 | Gestión de usuarios y roles alineados con Jira (`Administrador`, `Coordinador`, `Profesional`, `Recepción`, `Voluntario`) | `src/views/UsersView.vue` | `GET/POST/PATCH /api/v1/users` | Implementado y probado |
| **RF-12 a RF-16** | SCRUM-183 | Control de asistencia sabatina y seguimiento por actividad | `src/views/AttendanceView.vue` | `getAttendance`, `updateAttendance` | Implementado y probado |
| **RF-17** | SCRUM-135 / SCRUM-179 | Registro y consulta de auditoría de operaciones sensibles solo para Administrador | `src/views/AuditView.vue` | `GET /api/v1/audit` (`syncAuditFromApi`) | Implementado y probado |
| **RNF-02** | SCRUM-12 / SCRUM-67 | Sesiones JWT, expiración automática (30 min / 15 min inactividad), renovación y logout | `src/App.vue`, `src/router/index.ts` | `GET /api/v1/auth/verify`, `POST /api/v1/auth/logout` | Implementado y probado |
| **RNF-06** | SCRUM-123 / SCRUM-138 | Protección de datos clínicos según consentimiento informado y estado de acceso | `src/views/PatientsView.vue`, `src/views/AttendanceView.vue` | `canViewClinicalRecord`, `updatePatient` | Implementado y probado |
| **RNF-11** | SCRUM-128 / SCRUM-153 | Estándares de código (ESLint, Prettier, TypeScript) y pruebas de componentes | `eslint.config.mjs`, `.prettierrc.json`, `src/views/__test__/*.spec.ts` (Login, Pacientes, Usuarios, Bitácora) | Pipeline CI/CD GitHub Actions | Implementado y probado |

## Trazabilidad del Backend: Servicios, Datos, Endpoints y Pruebas (SCRUM-136 / SCRUM-182)

Alineación de cada requisito del SRS con su implementación en el Backend FastAPI sobre Supabase PostgreSQL. Las pruebas citadas están en `Backend/tests/` y se ejecutan en `.github/workflows/ci-backend.yml`.

| ID Req. | Endpoint(s) `/api/v1` | Servicio / Componente C3 | Tabla(s) PostgreSQL | Pruebas automáticas | Estado Backend |
| :--- | :--- | :--- | :--- | :--- | :--- |
| **RF-01** | `POST /auth/login`, `GET /auth/verify` | `services/auth_service.py`, `core/security.py` (bcrypt + JWT) | `users`, `sessions` | `test_auth_login.py`, `test_auth_credentials.py`, `test_security.py` | Implementado (SCRUM-26, SCRUM-27) |
| **RF-02** | `GET/POST /patients`, `GET/PATCH/DELETE /patients/{id}` | `services/patient_service.py` | `patients` | `test_patients_api.py`, `test_patient_model.py` | Implementado (SCRUM-31, SCRUM-32) |
| **RF-03 / RF-09** | — | — | `inventory_items` (migración 001) | `test_migrations.py` (esquema) | Modelo de datos listo; endpoints planificados para el Sprint 2 |
| **RF-04 / RF-10** | — | — | `schedules` | `test_migrations.py` | Modelo de datos listo; endpoints en Sprint 2 |
| **RF-05** | — | `adapters/storage.py` (reutilizable) | `media_assets` | `test_storage_adapter.py` | Adaptador de Storage listo; galería en Sprint 2 |
| **RF-06** | — | — | `donations`, `institutional_info` | `test_migrations.py` | Modelo de datos listo; endpoints en Sprint 2 |
| **RF-07 / RF-08** | — | — | `institutional_info` | `test_migrations.py` | Modelo de datos listo; endpoints en Sprint 2 |
| **RF-11** | `GET/POST /users`, `PATCH /users/{id}`, `POST /users/{id}/reset-password` | `services/user_service.py` | `users`, `sessions` | `test_users_api.py` | Implementado (SCRUM-160) |
| **RF-12 a RF-16** | — | — | `attendance` | `test_migrations.py` | Modelo de datos listo; endpoints en Sprint 2 |
| **RF-17** | `GET /audit` | `services/audit_service.py` (único punto de escritura), `core/deps.py` (accesos denegados) | `audit_logs` (inmutable por trigger) | `test_audit.py` | Implementado (SCRUM-178) |
| **RNF-02** | `POST /auth/refresh`, `POST /auth/logout` | `core/deps.py` (30 min máx., 15 min inactividad, revocación) | `sessions` | `test_sessions.py` | Implementado (SCRUM-29) |
| **RNF-06** | `GET /patients*`, `/patients/{id}/documents*` | `patient_service.can_view_clinical_record`, `services/document_service.py` | `patients`, `patient_documents`, bucket privado `documentos-pacientes` | `test_patient_privacy.py` | Implementado (SCRUM-137) |
| **RNF-11** | — | Ruff + pytest + migraciones versionadas (`scripts/migrate.py`) | `schema_migrations` | `test_migrations.py`, pipeline CI | Implementado (SCRUM-152, SCRUM-95) |

### Diferencias resueltas entre la documentación anterior y la implementación

| Tema | Antes (Sprint 1 inicial) | Ahora (Backend Supabase) |
| :--- | :--- | :--- |
| Base de datos | SQLite local `aspar.db` | Supabase PostgreSQL con migraciones versionadas |
| Contraseñas | SHA-256 con sal fija | bcrypt (costo 12), exigido por RNF-02 |
| Expiración de sesión | Solo en el token | Validada en servidor contra la tabla `sessions` (máximo, inactividad y logout) |
| Protección RNF-06 | Solo en el frontend (`canViewClinicalRecord`) | También en el servidor: la anamnesis no sale de la API sin rol clínico y consentimiento |
| Bitácora | Escritura desde frontend y backend | Solo el Backend escribe; la tabla es inmutable |
| Contrato | Descrito en `MODELO_DATOS_Y_CONTRATOS.md` | Verificado por prueba automática contra `Frontend/src/types/aspar.ts` |
