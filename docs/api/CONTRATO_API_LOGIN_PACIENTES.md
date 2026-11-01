# Contrato de la API: acceso, sesiones, paginación y afiliados (SCRUM-58 / SCRUM-86)

Contrato vigente entre el **Backend FastAPI** (`Backend/app/modules/*/router.py`) y el **Frontend Vue 3** (`Frontend/src/api/`) al cerrar el Backend del Sprint 2.

- **Especificación completa:** [`openapi.json`](./openapi.json), 104 operaciones. Se genera con `python -m scripts.export_openapi`; el CI falla si no está al día.
- **Tipos del frontend:** `Frontend/src/api/schema.d.ts`, generados desde `openapi.json` con `npm run api:types`. Ninguna interfaz se escribe a mano ([ADR-013](../arquitectura/adr/ADR-013-contrato-openapi-y-capa-src-api.md)).
- **Base URL:** `VITE_API_BASE_URL` (por defecto `http://localhost:8000/api/v1`).
- **Formato:** JSON en camelCase en todas las rutas.
- **Errores:** siempre `{"detail": "<mensaje en español>"}`. El frontend lo muestra tal cual.
- **Sesión:** cookies HttpOnly y token CSRF, nunca `Authorization: Bearer` ([ADR-012](../arquitectura/adr/ADR-012-sesion-en-cookies-y-permisos-en-la-base.md)).

## 1. Acceso: dos formas de entrar (RF-01)

| Método y ruta | Cuerpo | Respuesta | Método en `src/api` |
| :--- | :--- | :--- | :--- |
| `POST /auth/login` | `{ email, password }` | `200 SessionOut` + cookies | `session.login()` |
| `POST /auth/google` | `{ credential }` (ID token de Google Identity Services) | `200 SessionOut` + cookies | `session.loginWithGoogle()` |
| `POST /auth/register` | `{ name, email, password, turnstileToken }` | `202 { message }` | `api.auth.register()` |
| `POST /auth/verify-email` | `{ token }` | `200 { message }` | `api.auth.verifyEmail()` |
| `POST /auth/resend-verification` | `{ email, turnstileToken }` | `202 { message }` | `api.auth.resendVerification()` |
| `POST /auth/forgot-password` | `{ email, turnstileToken }` | `202 { message }` | `api.auth.forgotPassword()` |
| `POST /auth/reset-password` | `{ token, password }` | `200 { message }` | `api.auth.resetPassword()` |
| `POST /auth/change-password` | `{ currentPassword, newPassword }` | `200 SessionOut` | `session.changePassword()` |

**Contraseña y correo:**

- Las contraseñas se guardan con bcrypt (costo 12). Deben tener al menos 8 caracteres, letras y números, y como máximo 72 bytes.
- El login ejecuta bcrypt **siempre**, aunque el correo no exista, para que el tiempo de respuesta no revele qué cuentas hay.
- Tras **5 intentos fallidos** la cuenta se bloquea **15 minutos**. Durante el bloqueo la respuesta sigue siendo el mismo 401, así un atacante no sabe si acertó.
- El registro, el reenvío y la recuperación responden **siempre** `202` con el mismo mensaje («Si los datos son correctos, te enviamos un correo…»), exista o no la cuenta. Los tres exigen Turnstile.
- Los enlaces de los correos (enviados por Resend) son de un solo uso y se guardan como SHA-256: verificación 24 h, recuperación 60 min.

**Google:**

- La API verifica la firma del ID token con las claves públicas de Google, el `GOOGLE_CLIENT_ID`, el emisor, el vencimiento y que el correo esté verificado.
- Si el correo ya tiene una cuenta **verificada**, se vincula. Si la cuenta existe pero no confirmó su correo, la API responde 409 y no la vincula: así nadie se apropia de una cuenta registrada con un correo ajeno.
- Si no existe, se crea una cuenta **pendiente de aprobación** (sin rol).

**Cuentas nuevas:** quien se registra por el sitio o con Google entra sin rol y no ve ningún dato hasta que Administración la aprueba (`POST /users/{id}/approve`). Las cuentas que crea Administración (`POST /users`) reciben una **contraseña temporal** (72 h) que se muestra una sola vez y hay que cambiar al ingresar.

**Límites por IP y por cuenta** (tabla `rate_limits`, compartida entre instancias): login 30 por IP y 10 por cuenta cada 15 min; Google 30 por IP cada 15 min; registro 5 por IP por hora; correos 5 por IP y 3 por cuenta por hora; enlaces 20 por IP por hora. Al pasarse: **429** «Demasiados intentos. Espera N minutos…».

## 2. Sesión (RNF-02)

| Método y ruta | Respuesta | Uso |
| :--- | :--- | :--- |
| `GET /auth/me` | `200 SessionOut` | El frontend la consulta al cargar la página |
| `POST /auth/refresh` | `200 SessionOut` + cookies renovadas | Antes de que venza `expiresIn` |
| `POST /auth/logout` | `200 { message }` y borra las cookies | Cierre manual |

**`SessionOut`:**

```json
{
  "user": {
    "id": "6f1c…",
    "name": "Rosa Vásquez",
    "email": "rosa@aspar.com",
    "role": "coordination",
    "roleName": "Coordinación",
    "department": "Coordinación general",
    "active": true,
    "emailVerified": true,
    "mustChangePassword": false,
    "hasPassword": true,
    "googleLinked": false
  },
  "permissions": ["attendance:write", "patients:read", "patients:read_clinical", "…"],
  "expiresIn": 1800,
  "idleTimeout": 900,
  "csrfToken": "3b9d…"
}
```

| Regla | Valor | Dónde se decide |
| :--- | :--- | :--- |
| Duración del token | 30 min (`expiresIn`), se renueva con `/auth/refresh` | `sessions.expires_at` |
| Inactividad | 15 min sin peticiones cierran la sesión (`idleTimeout`) | `sessions.last_activity_at` |
| Tope absoluto | 8 h desde el login, aunque se renueve | `sessions.absolute_expires_at` |
| Cierre | `logout`, restablecer la contraseña, desactivar la cuenta o cambiarle el rol | `sessions.revoked_at` |

- La cookie `aspar_session` (HttpOnly, `Path=/api`) lleva el JWT; la cookie `aspar_csrf` lleva el token CSRF.
- Toda petición `POST`, `PUT`, `PATCH` o `DELETE` debe enviar `X-CSRF-Token`; sin él la API responde **403**. `HttpClient` lo hace solo.
- `permissions` decide qué menús muestra el frontend (`session.can`). La API vuelve a verificar cada permiso en cada petición.

**Respuestas de error del acceso y la sesión:**

| Código | Cuándo | `detail` |
| :--- | :--- | :--- |
| `401` | Correo inexistente, contraseña incorrecta, cuenta inactiva o bloqueada (mismo mensaje para todo) | `No pudimos iniciar sesión. Revisa tu correo y contraseña e inténtalo de nuevo. Tras 5 intentos fallidos el acceso se pausa 15 minutos.` |
| `401` | Sin cookie | `Inicia sesión para continuar.` |
| `401` | Token alterado, vencido, revocado o con más de 8 h | `Sesión inválida o expirada. Inicia sesión nuevamente.` |
| `401` | 15 min sin actividad | `La sesión expiró por inactividad (15 minutos). Inicia sesión nuevamente.` |
| `401` | Contraseña temporal vencida | `La contraseña temporal venció. Pide a Administración una nueva.` |
| `403` | Contraseña correcta pero correo sin confirmar | `Confirma tu correo antes de ingresar: …` |
| `403` | Falta `X-CSRF-Token` o no coincide | `Falta el token de seguridad de la sesión (X-CSRF-Token). Recarga la página.` |
| `403` | `Origin` no permitido | `Origen no permitido.` |
| `400` | Turnstile rechazado | `No pudimos comprobar que eres una persona. …` |
| `422` | Correo mal formado, contraseña débil o campos faltantes | p. ej. `La contraseña debe combinar letras y números.` |
| `429` | Límite de intentos | `Demasiados intentos. Espera N minutos y vuelve a intentarlo.` |

En el frontend, cualquier **401** en una petición con sesión marca la sesión como vencida (`session.expire()`) y la app vuelve al login.

## 3. Paginación de los listados

Todos los listados que pueden crecer (afiliados, equipo, bitácora, inventario, donaciones, solicitudes y actividades) devuelven el mismo sobre:

```json
{ "items": [ … ], "total": 128, "limit": 50, "offset": 50 }
```

| Parámetro | Valor | Error |
| :--- | :--- | :--- |
| `limit` | 1 a 200, por defecto 50 | `422` fuera de rango |
| `offset` | 0 o más, por defecto 0 | `422` si es negativo |

- `total` cuenta todas las filas que cumplen los filtros, no solo las de la página.
- Cada consulta ordena con el `id` al final, así dos páginas nunca repiten ni saltan filas.
- La búsqueda (`?search=`) es parcial y sin distinguir mayúsculas; usa los índices `pg_trgm` de la migración 002.
- En `src/api`, los métodos `list` reciben `{ limit, offset, … }` y devuelven el sobre tipado (`PatientPage`, `UserPage`…).

## 4. Afiliados y privacidad clínica (RF-02, RNF-06)

| Método y ruta | Permiso | Respuesta |
| :--- | :--- | :--- |
| `GET /patients?search=&status=&includeInactive=&limit=&offset=` | `patients:read` | `200 PatientPage` (filas `PatientSummaryOut`) |
| `GET /patients/{id}` | `patients:read` | `200 PatientOut` |
| `POST /patients` | `patients:write` | `201 PatientOut` |
| `PATCH /patients/{id}` | `patients:write` (y `patients:write_clinical` para síntomas y medicación) | `200 PatientOut` |
| `POST /patients/{id}/deactivate` · `/reactivate` | `patients:deactivate` | `200 PatientOut` |
| `GET/POST /patients/{id}/contacts`, `PATCH/DELETE …/contacts/{contactId}` | `patients:read` / `patients:write` | Familiares y cuidadores |
| `GET/POST /patients/{id}/evaluations`, `GET/PATCH …/{evaluationId}` | `patients:read_clinical` / `patients:write_clinical` | Evaluaciones física, fonoaudiológica y psicológica |
| `GET/POST /patients/{id}/documents`, `DELETE …/{documentId}`, `GET …/{documentId}/url` | `patients:read_clinical`, `documents:upload`, `documents:delete` | Documentos privados (PDF o imagen hasta 10 MB), URL firmada de 300 s |

### Dos formas de un afiliado: `PatientSummaryOut` y `PatientOut`

| Campo | `PatientSummaryOut` (listado) | `PatientOut` (ficha) |
| :--- | :---: | :---: |
| `id`, `name`, `ci`, `phone`, `zone` | ✅ | ✅ |
| `consent`, `imageConsent`, `accessStatus`, `active` | ✅ | ✅ |
| `primaryContact` | ✅ | — |
| `contacts` (todos los activos) | — | ✅ |
| `birthDate`, `address`, `consentDate`, `deactivationReason` | — | ✅ |
| `anamnesis` (`diagnosis`, `stage`, `neurologistCertificate`, `symptomNotes`, `medications`) | **nunca** | Solo con acceso clínico; si no, llega vacía |
| `clinicalAccess` | — | ✅ |
| `createdAt`, `updatedAt` | ✅ | ✅ |

- **El listado nunca lleva datos clínicos**, para nadie. Así una lista de 50 fichas no expone 50 historias clínicas.
- **La ficha** muestra la anamnesis solo si se cumplen las **tres** condiciones de `can_view_clinical_record`: permiso `patients:read_clinical`, consentimiento firmado y acceso `Activo`. Si falta una, `clinicalAccess` es `false` y `anamnesis` llega con textos vacíos.
- **La regla del consentimiento no depende del rol:** aunque Administración dé el permiso clínico a otro rol, sin consentimiento y acceso `Activo` nadie ve la anamnesis, las evaluaciones ni los documentos (estos dos últimos responden **403**).
- Cada consulta de una ficha con anamnesis queda en la bitácora («Consulta de ficha clínica»).
- La base impide `accessStatus: "Activo"` sin consentimiento (`CHECK`). Al retirar el consentimiento con `PATCH`, la API borra la fecha y deja el acceso en `Pendiente`; el cambio queda en la bitácora como `CONSENTIMIENTO`.
- **Baja lógica:** un afiliado no se borra. `deactivate` exige motivo; la ficha sale del listado salvo con `includeInactive=true`.

**Ejemplo de `PatientOut` con acceso clínico:**

```json
{
  "id": "0b7e…",
  "name": "Elena Rojas",
  "ci": "1234567",
  "birthDate": "1956-03-14",
  "phone": "70000001",
  "address": "Av. Arce #2140",
  "zone": "Sopocachi",
  "consent": true,
  "consentDate": "2026-08-15",
  "imageConsent": false,
  "accessStatus": "Activo",
  "anamnesis": {
    "diagnosis": "Enfermedad de Parkinson idiopática",
    "stage": "Estadio II (Bilateral sin alteración del equilibrio)",
    "neurologistCertificate": true,
    "symptomNotes": "…",
    "medications": "Levodopa/Carbidopa 250/25 mg cada 8 horas"
  },
  "clinicalAccess": true,
  "contacts": [
    { "id": "9a2c…", "name": "Carlos Rojas", "relation": "Hijo", "phone": "71522334", "altPhone": null, "isPrimary": true }
  ],
  "active": true,
  "deactivationReason": null,
  "createdAt": "2026-10-26T15:04:02.193404Z",
  "updatedAt": "2026-10-26T15:04:02.193404Z"
}
```

**Errores de afiliados:**

| Código | Cuándo | `detail` |
| :--- | :--- | :--- |
| `403` | El rol no tiene el permiso de la ruta | Mensaje de permiso; queda en la bitácora |
| `403` | Registrar síntomas o medicación sin `patients:write_clinical` | `Tu rol no tiene permiso para registrar síntomas y medicación (datos clínicos, RNF-06).` |
| `403` | Evaluaciones o documentos sin consentimiento o sin acceso `Activo` | Mensaje RNF-06 |
| `404` | Id inexistente | `Afiliado no encontrado.` |
| `409` | CI ya registrada (también si dos personas la registran a la vez) | `Ya existe un afiliado registrado con esa Cédula de Identidad.` |
| `409` | Dar de baja una ficha ya dada de baja | `La ficha ya está dada de baja.` |
| `422` | Nombre, CI, teléfono, contacto o activar sin consentimiento | p. ej. `No se puede activar el acceso clínico sin consentimiento informado firmado (RNF-06).` |

## 5. Pruebas que sostienen este contrato

| Tema | Backend (`Backend/tests/`) | Frontend |
| :--- | :--- | :--- |
| Login, bloqueo y mensajes | `test_auth_login.py`, `test_auth_credentials.py`, `test_security.py` | `src/api/__test__/session.spec.ts`, `LoginView.spec.ts` |
| Registro, Google, correos y aprobación | `test_accounts.py`, `test_adapters.py` | `src/api/__test__/endpoints.spec.ts` |
| Sesión, cookies, CSRF e inactividad | `test_sessions.py`, `test_hardening.py` | `src/api/__test__/client.spec.ts` |
| Permisos | `test_permissions.py`, `test_roles.py` | `session.spec.ts` (`can`, `canAny`) |
| Paginación | `test_pagination.py` | `endpoints.spec.ts` |
| Afiliados y RNF-06 | `test_patients_api.py`, `test_patient_model.py`, `test_patient_privacy.py`, `test_contacts_evaluations.py`, `test_storage_adapter.py` | `PatientsView.spec.ts` (modo demo) |
| Contrato completo | `test_openapi.py`, `scripts.export_openapi --check`, `test_core.py` (todo error es `{detail: texto}`) | `npm run api:types:check`, `endpoints.spec.ts` (todas las operaciones cubiertas) |

## 6. Pendiente de integración en el Frontend

El contrato está completo. Lo que falta es de la **migración visual**: que las vistas (`src/views/`) usen `src/api/` en lugar de `src/services/` (modo demo, ADR-008). En particular:

1. `LoginView` con `session.login`, «Continuar con Google» y Turnstile en registro y recuperación.
2. `PatientsView` con el listado paginado (`PatientSummaryOut`) y la ficha (`PatientOut`) con evaluaciones y documentos.
3. Contador de sesión de `App.vue` con `expiresIn` e `idleTimeout` de la API y `session.refresh()`.
