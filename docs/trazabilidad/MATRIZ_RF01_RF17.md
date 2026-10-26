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
| **RNF-11** | SCRUM-128 / SCRUM-153 | Estándares de código (ESLint, Prettier, TypeScript) y pruebas de componentes | `eslint.config.mjs`, `.prettierrc.json`, `LoginView.spec.ts` | Pipeline CI/CD GitHub Actions | Implementado y probado |
