# ASPAR Frontend — Sistema Web y de Gestión Clínica y Administrativa

Interfaz web tipo **Single Page Application (SPA)** desarrollada con **Vue 3 + TypeScript + Vite** por **Soluna Solutions** para la **Asociación de Parkinson "Mario Lagrava" (ASPAR)** en La Paz, Bolivia.

## 1. Requisitos del Entorno

- **Node.js**: `>= 20.19.0` (recomendado `v20 LTS` o `v22 LTS`)
- **npm**: `>= 10.0.0`
- **Backend API (opcional para desarrollo local autónomo, requerido para integración E2E)**: Python `3.12+` con FastAPI (`uvicorn app.main:app --reload --port 8000`)

## 2. Configuración de Variables de Entorno (`.env`)

1. Copia el archivo de plantilla `.env.example` en la carpeta `Frontend/`:
   ```bash
   cp .env.example .env
   ```
2. Ajusta la URL de la API si no corre en `localhost:8000`:
   ```dotenv
   VITE_API_BASE_URL=http://localhost:8000/api/v1
   ```
   `VITE_DEMO_MODE=true` habilita el modo local de demostración en un build de producción (con `npm run dev` siempre está activo). Por defecto es `false`: en producción, si la API no responde, nadie entra con las cuentas de prueba. Los tiempos de sesión los define el Backend (`Backend/.env`).

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
export JWT_SECRET="$(python -c 'import secrets; print(secrets.token_urlsafe(32))')"
uvicorn app.main:app --reload --host 0.0.0.0 --port 8000
```

> El Backend lee `JWT_SECRET` de la variable de entorno (ver `Backend/.env.example`). Si no se define, usa un valor solo apto para desarrollo local.

## 4. Scripts de Calidad, Pruebas y Construcción (SCRUM-153 / SCRUM-96)

| Script | Comando | Propósito |
| :--- | :--- | :--- |
| `npm run dev` | `vite` | Inicia el servidor de desarrollo con HMR |
| `npm run build` | `vue-tsc -b && vite build` | Verifica tipos TypeScript y genera el bundle de producción en `dist/` |
| `npm run lint` | `eslint .` | Ejecuta el análisis estático con ESLint + `typescript-eslint` + `eslint-plugin-vue` |
| `npm run format` | `prettier --write .` | Formatea el código fuente siguiendo `.prettierrc.json` |
| `npm run test:run` | `vitest run` | Ejecuta la suite de pruebas de componentes y servicios en `src/views/__test__/` |
| `npm run test:coverage` | `vitest run --coverage` | Igual que `test:run`, mide la cobertura y falla si baja del 70% (RNF-05 / SCRUM-97) |
| `npm run api:types` | `node scripts/api-types.mjs` | Regenera `src/api/schema.d.ts` desde `docs/api/openapi.json` |
| `npm run api:types:check` | `node scripts/api-types.mjs --check` | Falla si `src/api/schema.d.ts` no coincide con el contrato (lo usa el CI) |

### Tipos de la API generados desde el contrato

Los tipos de cada endpoint (cuerpos, respuestas y parámetros) no se escriben a mano: se generan con [`openapi-typescript`](https://openapi-ts.dev) desde [`docs/api/openapi.json`](../docs/api/openapi.json), que a su vez exporta el Backend. Si cambias un endpoint:

```bash
# Desde Backend/
python -m scripts.export_openapi
# Desde Frontend/
npm run api:types
```

Sube los dos archivos (`openapi.json` y `src/api/schema.d.ts`) en el mismo commit. Un cambio en la API que rompa al frontend aparece como error de TypeScript en `npm run build`.

### Capa de datos `src/api/`

Es la forma de hablar con la API desde el Sprint 2. Las vistas actuales todavía usan `src/services/` y el modo demo (ADR-008); se migrarán una por una a esta capa.

```ts
import { api, isApiError, session } from '../api'

await session.restore() // al cargar la página: ¿sigue la cookie de sesión?
await session.login(email, password) // guarda usuario, permisos y token CSRF

if (session.can('patients:read')) {
  const page = await api.patients.list({ search: 'rojas', limit: 20, offset: 0 })
  // page.items, page.total, page.limit, page.offset
}

try {
  await api.users.create({ name, email, role: 'volunteer' })
} catch (error) {
  if (isApiError(error)) mostrar(error.message) // mensaje de la API, listo para la persona
}
```

- **Sesión en cookies**: el token vive en la cookie `HttpOnly` `aspar_session`; JavaScript nunca lo ve ni lo guarda en `localStorage`. Todas las peticiones van con `credentials: 'include'`.
- **CSRF**: en `POST/PUT/PATCH/DELETE` el cliente agrega `X-CSRF-Token` con el token que llega en cada respuesta de sesión (o la cookie legible `aspar_csrf`).
- **Errores**: todo error es un `ApiError` con `status` y el `message` que envía la API; `status === 0` significa sin conexión y `retryAfter` indica cuánto esperar tras un 429.
- **Sesión vencida**: un 401 en cualquier petición con sesión deja `session.state.status === 'expired'`, para que la app lleve a la persona al login.
- **Permisos**: `session.can(...)` y `session.canAny(...)` solo deciden qué se muestra; la API los vuelve a verificar siempre. Las claves (`'patients:read'`...) están tipadas desde el contrato: un error de tipeo no compila.

## 5. Cuentas de Prueba por Rol (RF-01 / RF-11)

> Estas cuentas solo se muestran en la pantalla de login en modo desarrollo (`npm run dev`); el build de producción las oculta.

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
├── scripts/api-types.mjs        # Genera y verifica src/api/schema.d.ts desde docs/api/openapi.json
├── src/
│   ├── api/                     # Capa de datos nueva (Sprint 2): API real con cookies y CSRF
│   │   ├── schema.d.ts          # GENERADO: tipos de la API desde openapi.json (no editar)
│   │   ├── types.ts             # Nombres cortos de esos tipos (SessionOut, PatientPage, Permission...)
│   │   ├── client.ts            # HttpClient: credentials 'include', X-CSRF-Token, errores
│   │   ├── errors.ts            # ApiError con el mensaje de la API (status 0 = sin conexión)
│   │   ├── endpoints.ts         # Un método por endpoint: api.patients.list(), api.users.create()...
│   │   ├── session.ts           # Estado de sesión y permisos: login, restore, can('patients:read')
│   │   ├── index.ts             # Instancias compartidas: import { api, session } from '../api'
│   │   └── __test__/            # Pruebas de la capa con fetch simulado
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
