# Contrato de la API: Login, Sesión y Pacientes (SCRUM-58 / SCRUM-86)

Contrato confirmado entre el **Backend FastAPI** (`Backend/app/routers/`) y el **Frontend Vue 3** (`Frontend/src/services/api.ts`, tipos en `Frontend/src/types/aspar.ts`). La prueba automática [`Backend/tests/test_contract_frontend.py`](../../Backend/tests/test_contract_frontend.py) lee las interfaces TypeScript y falla en CI si una respuesta deja de cumplirlas.

- **Especificación OpenAPI completa:** [`openapi.json`](./openapi.json) (14 rutas, generada con `python -m scripts.export_openapi`).
- **Base URL:** `VITE_API_BASE_URL` (por defecto `http://localhost:8000/api/v1`).
- **Autenticación:** cabecera `Authorization: Bearer <access_token>` en todo excepto `POST /auth/login` y `GET /health`.
- **Formato:** JSON en camelCase para pacientes, usuarios y bitácora; snake_case en el login (`access_token`, `expires_in`), igual que `LoginResponseDto`.
- **Errores:** siempre `{"detail": "<mensaje en español>"}`; el frontend muestra ese texto tal cual.

## 1. Autenticación y sesión (RF-01, RNF-02)

| Método y ruta | Cuerpo | Respuesta 2xx | Tipo frontend | Función en `api.ts` |
| :--- | :--- | :--- | :--- | :--- |
| `POST /auth/login` | `{ email, password }` | `200` `{ access_token, token_type: "bearer", expires_in: 1800, idle_timeout: 900, user }` | `LoginRequestDto` → `LoginResponseDto` | `login()` |
| `GET /auth/verify` | — | `200` `{ valid: true, user: { sub, email, name, role } }` | — | `verifySession()` |
| `POST /auth/refresh` | — | `200` `{ access_token, token_type, expires_in }` | `RefreshResponseDto` | `refresh()` |
| `POST /auth/logout` | — | `200` `{ message }` | — | `logout()` |

**Token JWT (HS256):** `{ sub, sid, email, name, role, iat, exp }`. `iat` y `exp` van en **milisegundos** porque `decodeJwtExpiry()` los compara con `Date.now()`. La validez real la decide la tabla `sessions`: 30 minutos desde el login o el último refresh, 15 minutos sin actividad y revocación por logout.

| Código | Cuándo | `detail` |
| :--- | :--- | :--- |
| `401` | Credenciales inválidas, correo inexistente o usuario inactivo | `Correo o contraseña incorrectos, o usuario inactivo.` |
| `401` | Token ausente, alterado, vencido, revocado o inactivo 15 min | `Token Bearer requerido` / `Sesión inválida o expirada...` / `La sesión expiró por inactividad...` |
| `422` | Correo mal formado o campos faltantes | p. ej. `correo electrónico: ingresa un correo electrónico válido` |
| `423` | 5 intentos fallidos seguidos (bloqueo de 15 min) | `Cuenta bloqueada temporalmente por N minutos tras 5 intentos fallidos (RNF-02).` |

## 2. Pacientes y anamnesis (RF-02, RNF-06)

| Método y ruta | Roles | Cuerpo | Respuesta 2xx | Función en `api.ts` |
| :--- | :--- | :--- | :--- | :--- |
| `GET /patients?search=&status=` | Todos los autenticados | — | `200` `Patient[]` | `fetchPatients()` |
| `GET /patients/{id}` | Todos los autenticados | — | `200` `Patient` | — |
| `POST /patients` | Administrador, Coordinador, Profesional, Recepción | `Omit<Patient, 'id'>` | `201` `Patient` | `createPatient()` |
| `PATCH /patients/{id}` | Administrador, Coordinador, Profesional, Recepción | `Partial<Patient>` | `200` `Patient` | `patchPatient()` |
| `DELETE /patients/{id}` | Administrador | — | `200` `{ message }` | — |

**Ejemplo de `Patient`:**

```json
{
  "id": "p-1",
  "name": "Elena Rojas",
  "ci": "1234567",
  "phone": "70000001",
  "address": "Av. Arce #2140, Sopocachi, La Paz",
  "emergencyContact": "Carlos Rojas (71522334)",
  "caregiverRelation": "Hijo / Cuidador principal",
  "consent": true,
  "consentDate": "2026-08-15",
  "accessStatus": "Activo",
  "anamnesis": {
    "diagnosis": "Enfermedad de Parkinson idiopática",
    "stage": "Estadio II (Bilateral sin alteración del equilibrio)",
    "neurologistCertificate": true,
    "symptomNotes": "...",
    "physicalEvaluation": "...",
    "speechEvaluation": "...",
    "psychologicalEvaluation": "...",
    "medications": "Levodopa/Carbidopa 250/25 mg cada 8 horas"
  },
  "clinicalAccess": true,
  "createdAt": "2026-10-26T15:04:02.193404+00:00",
  "updatedAt": "2026-10-26T15:04:02.193404+00:00"
}
```

**Reglas acordadas:**
- `consentDate` llega como `""` cuando no hay consentimiento (el frontend envía `""` y el Backend lo guarda como `null`).
- `clinicalAccess` es un campo adicional: `false` cuando el rol no es clínico o el paciente no tiene consentimiento y acceso `Activo`; en ese caso `anamnesis` llega con textos vacíos (RNF-06, misma regla que `canViewClinicalRecord()`).
- Al retirar el consentimiento con `PATCH`, el Backend fuerza `accessStatus: "Pendiente"` igual que `updatePatient()` del frontend.

| Código | Cuándo | `detail` |
| :--- | :--- | :--- |
| `403` | Rol sin permiso, o Recepción intentando registrar evaluaciones clínicas | `El rol X no tiene permisos...` / `Solo el personal clínico...` |
| `404` | Id inexistente | `Paciente no encontrado.` |
| `409` | CI ya registrada | `Ya existe un paciente registrado con esa Cédula de Identidad.` |
| `422` | Mismas validaciones que `validatePatientInput()` | Mismos mensajes del frontend (nombre, CI, teléfono, contacto, consentimiento) |

## 3. Pendientes de integración en el Frontend

Estos puntos no requieren cambios de contrato, pero sí ajustes en `Frontend/src/services/aspar.ts` (responsabilidad del frontend):

1. `savePatient()`, `updatePatient()`, `createUser()` y `updateUser()` guardan primero en `localStorage` e ignoran los errores de la API (`.catch(() => undefined)`); para que Supabase sea la fuente de verdad deben esperar la respuesta y mostrar `detail`.
2. `createUser()` no envía contraseña: el Backend genera una temporal y la devuelve en `temporaryPassword`, que la pantalla de usuarios debería mostrar una única vez.
3. Mostrar los documentos privados (`/patients/{id}/documents`) en la ficha del paciente.
