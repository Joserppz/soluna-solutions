# Arquitectura C4, Modelo de Datos E-R y Contratos de API (SCRUM-64 / SCRUM-105)

## 1. Alineación con la Arquitectura C4 (FastAPI + PostgreSQL + Vue 3 SPA)

El diseño de tipos y formularios del Frontend (`Frontend/src/types/aspar.ts`) refleja los componentes definidos en los diagramas **C1, C2 y C3**:

- **JWT Auth Middleware (`/api/v1/auth/*`)**: Maneja credenciales cifradas, emisión de token Bearer (`access_token`), tiempo de expiración máxima (`30 min`) y límite de inactividad (`15 min`) conforme a **RF-01** y **RNF-02**.
- **PatientRouter & PatientService (`/api/v1/patients/*`)**: Gestiona fichas de afiliados, contacto de emergencia/cuidador, estado de consentimiento informado (**RNF-06**) y anamnesis clínica integral (diagnóstico de Parkinson, estadio Hoehn y Yahr, certificado neurológico y evaluaciones física, fonoaudiológica y psicológica) conforme a **RF-02**.
- **UserRouter (`/api/v1/users/*`)**: Administra usuarios y roles oficiales de ASPAR (`Administrador`, `Coordinador`, `Profesional`, `Recepción`, `Voluntario`) según **RF-11**.
- **AuditRouter (`/api/v1/audit/*`)**: Registra y consulta eventos de auditoría de operaciones sensibles con nivel de severidad (`INFO`, `WARNING`, `CRITICAL`) y categoría, restringido al rol `Administrador` según **RF-17**.
- **InventoryRouter (`/api/v1/inventory/*`)**: Controla mobiliario e insumos clasificados por origen (`Propio ASPAR`, `Préstamo Alcaldía`, `Donación`) y estado físico para reportes ante la Alcaldía (**RF-03**, **RF-09**).
- **ScheduleRouter, MultimediaRouter & DonationRouter**: Cubren cronogramas sabatinos (**RF-04**, **RF-10**), activos multimedia en Cloud Storage (**RF-05**) y donaciones vía QR/Libélula (**RF-06**).

## 2. Correspondencia de Entidades (Backend SQL <-> Frontend TypeScript)

| Tabla PostgreSQL | Interfaz Frontend (`src/types/aspar.ts`) | Campos Clave Validados | Requisito |
| :--- | :--- | :--- | :--- |
| `users` | `User` | `id`, `name`, `email`, `role`, `active`, `department`, `createdAt` | RF-01, RF-11 |
| `sessions` | `Session`, `LoginResponseDto` | `userId`, `token`, `expiresAt`, `lastActivityAt`, `role` | RNF-02 |
| `patients` | `Patient` | `id`, `name`, `ci`, `phone`, `address`, `emergencyContact`, `caregiverRelation`, `consent`, `accessStatus` | RF-02, RNF-06 |
| `patient_anamnesis` | `ClinicalAnamnesis` | `diagnosis`, `stage`, `neurologistCertificate`, `physicalEvaluation`, `speechEvaluation`, `psychologicalEvaluation`, `medications` | RF-02 |
| `audit_logs` | `AuditEvent` | `id`, `date`, `actor`, `actorRole`, `category`, `severity`, `action`, `detail`, `ipAddress` | RF-17 |
| `inventory_items` | `InventoryItem` | `id`, `code`, `name`, `category`, `quantity`, `origin`, `condition`, `location` | RF-03, RF-09 |
| `schedules` | `ScheduleItem` | `id`, `date`, `time`, `title`, `category`, `professional`, `location`, `spots` | RF-04, RF-10 |
| `media_assets` | `MediaAsset` | `id`, `title`, `type`, `storageProvider`, `url`, `sizeMb`, `uploadedAt` | RF-05 |
| `donations` | `DonationRecord` | `id`, `donorName`, `amountBs`, `method`, `purpose`, `status`, `date` | RF-06 |

## 3. Migración SQL Base (`Backend/migrations/001_initial_schema.sql`)

El esquema relacional incluye claves primarias UUID, restricciones `CHECK` para roles, estados de acceso (`Activo`, `Pendiente`, `Revocado`) y orígenes de inventario, asegurando integridad referencial entre pacientes, anamnesis y bitácora de auditoría.
