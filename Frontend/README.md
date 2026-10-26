# ASPAR Frontend — Sistema Web y de Gestión Clínica y Administrativa

Interfaz web tipo **Single Page Application (SPA)** desarrollada con **Vue 3 + TypeScript + Vite** por **Soluna Solutions** para la **Asociación de Parkinson "Mario Lagrava" (ASPAR)** en La Paz, Bolivia.

## 1. Requisitos del Entorno

- **Node.js**: `>= 20.19.0` (recomendado `v20 LTS` o `v22 LTS`)
- **npm**: `>= 10.0.0`
- **Backend API (opcional para desarrollo local autónomo, requerido para integración E2E)**: Python `3.11+` con FastAPI (`uvicorn app.main:app --reload --port 8000`)

## 2. Configuración de Variables de Entorno (`.env`)

1. Copia el archivo de plantilla `.env.example` en la carpeta `Frontend/`:
   ```bash
   cp .env.example .env
   ```
2. Ajusta las variables según tu entorno local o de despliegue:
   ```dotenv
   VITE_API_BASE_URL=http://localhost:8000/api/v1
   VITE_APP_NAME="ASPAR - Asociación de Parkinson Mario Lagrava"
   VITE_SESSION_MAX_AGE_MINUTES=30
   VITE_SESSION_IDLE_MINUTES=15
   ```

## 3. Instalación y Ejecución

```bash
# 1. Entrar al directorio del frontend
cd Frontend

# 2. Instalar dependencias
npm install

# 3. Levantar servidor de desarrollo (http://localhost:5173)
npm run dev
```

### Ejecución simultánea con el Backend FastAPI (Integración SCRUM-87)

```bash
# En otra terminal, desde la carpeta Backend/
cd Backend
uvicorn app.main:app --reload --host 0.0.0.0 --port 8000
```

## 4. Scripts de Calidad, Pruebas y Construcción (SCRUM-153 / SCRUM-96)

| Script | Comando | Propósito |
| :--- | :--- | :--- |
| `npm run dev` | `vite` | Inicia el servidor de desarrollo con HMR |
| `npm run build` | `vue-tsc -b && vite build` | Verifica tipos TypeScript y genera el bundle de producción en `dist/` |
| `npm run lint` | `eslint .` | Ejecuta el análisis estático con ESLint + `typescript-eslint` + `eslint-plugin-vue` |
| `npm run format` | `prettier --write .` | Formatea el código fuente siguiendo `.prettierrc.json` |
| `npm run test:run` | `vitest run` | Ejecuta la suite de pruebas de componentes y servicios en `src/views/__test__/` |

## 5. Cuentas de Prueba por Rol (RF-01 / RF-11)

| Rol Jira / ASPAR | Correo Electrónico | Contraseña | Permisos Clave |
| :--- | :--- | :--- | :--- |
| **Administrador** | `admin@aspar.org` | `Admin2026!` | Acceso total: Pacientes, Anamnesis, Asistencia, Inventario, Usuarios/Roles y Bitácora de Auditoría |
| **Coordinador** | `coordinacion@aspar.org` | `Coord2026!` | Gestión de pacientes, anamnesis, cronograma, asistencia e inventario |
| **Profesional** | `demo@aspar.org` | `Aspar2026!` | Consulta y registro de anamnesis clínica (fisioterapia, fonoaudiología, psicología) y asistencia |
| **Recepción** | `recepcion@aspar.org` | `Recep2026!` | Filiación inicial de pacientes, verificación de consentimiento y asistencia |
| **Voluntario** | `voluntario@aspar.org` | `Voluntario2026!` | Apoyo en actividades sabatinas y control de asistencia |

## 6. Estructura de Carpetas

```text
Frontend/
├── .env.example                 # Variables de entorno de referencia (SCRUM-91)
├── .prettierrc.json             # Reglas de formato Prettier (SCRUM-153)
├── eslint.config.mjs            # Configuración Flat ESLint + TS + Vue (SCRUM-153)
├── src/
│   ├── App.vue                  # Shell principal, barra de navegación y monitor de expiración de sesión (SCRUM-67)
│   ├── router/index.ts          # Rutas protegidas por autenticación y rol Administrador (SCRUM-67, SCRUM-179)
│   ├── types/aspar.ts           # Contratos DTO e interfaces alineadas al modelo C4 y PostgreSQL (SCRUM-105)
│   ├── services/
│   │   ├── api.ts               # Cliente HTTP RESTful hacia FastAPI (SCRUM-87)
│   │   └── aspar.ts             # Lógica de dominio, sesión JWT, validaciones y sincronización (SCRUM-66..179)
│   └── views/
│       ├── ScheduleView.vue     # Portal público, cronograma, galería Cloud y donaciones QR/Libélula (SCRUM-183)
│       ├── LoginView.vue        # Formulario de login con validaciones y bloqueo por intentos (SCRUM-66)
│       ├── PatientsView.vue     # Gestión de pacientes, anamnesis digital y consentimiento RNF-06 (SCRUM-68, SCRUM-138)
│       ├── RegisterPatientView.vue # Alta detallada de paciente y evaluación clínica (SCRUM-68)
│       ├── AttendanceView.vue   # Control de asistencia sabatina con validación de consentimiento (SCRUM-138)
│       ├── InventoryView.vue    # Inventario patrimonial y exportación CSV/PDF para la Alcaldía (SCRUM-183)
│       ├── UsersView.vue        # Administración de usuarios y roles Jira (SCRUM-161)
│       ├── AuditView.vue        # Bitácora de auditoría exclusiva para Administradores (SCRUM-179)
│       └── __test__/
│           └── LoginView.spec.ts # Suite de pruebas de componentes y reglas de negocio (SCRUM-153)
```
