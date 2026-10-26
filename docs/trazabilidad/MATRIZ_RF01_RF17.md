# Matriz de Trazabilidad Completa de Requisitos, Pantallas y Pruebas (SCRUM-136 / SCRUM-183)

Esta matriz alinea los requisitos funcionales y no funcionales (**RF01–RF17** y **RNF01–RNF11**) con las pantallas implementadas en el Frontend Vue 3, los endpoints del Backend FastAPI y los casos de prueba verificados.

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
