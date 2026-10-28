# Recorrido Integrado de Login y Pacientes — Sprint 1 (SCRUM-58 / SCRUM-88)

Prueba de punta a punta del Frontend Vue 3 contra la API FastAPI real y PostgreSQL 16, sin datos simulados. El recorrido está automatizado en [`Frontend/e2e/recorrido-integrado.cjs`](../../Frontend/e2e/recorrido-integrado.cjs) (Playwright + Chromium) y las capturas salen de esa misma ejecución.

## 1. Entorno de la ejecución

| Componente | Configuración |
| :--- | :--- |
| Base de datos | PostgreSQL 16 local, vacía, con las migraciones `001_initial_schema.sql` y `002_patient_documents.sql` aplicadas (`python -m scripts.migrate`) |
| API | `uvicorn app.main:app --port 8000` sobre la rama `Sprint1` |
| Frontend | `npm run dev` (Vite, puerto 5173) con `VITE_API_BASE_URL=http://localhost:8000/api/v1` |
| Navegador | Chromium (Playwright), ventana 1280 × 860 |

## 2. Resultado

| Paso | Qué se comprueba | Resultado observado | Estado |
| :--- | :--- | :--- | :--- |
| 1 | Login del Administrador desde `/login` | Sesión creada con el token de la API (`source = api`), rol `Administrador` | ✅ |
| 2 | Listado de `/pacientes` | La pantalla muestra los mismos 2 pacientes que devuelve `GET /patients` | ✅ |
| 3 | Alta de paciente desde el formulario | `POST /patients` → **201**; la ficha queda en PostgreSQL con estado `Pendiente` | ✅ |
| 4 | CI duplicada | `POST /patients` → **409** «Ya existe un paciente registrado con esa Cédula de Identidad.» | ✅ |
| 5 | Anamnesis con consentimiento (Administrador) | «Ver anamnesis» muestra la ficha clínica completa | ✅ |
| 6 | Anamnesis para el Voluntario (RNF-06) | La API **no envía** las evaluaciones clínicas y la pantalla muestra el aviso 🔒 | ✅ |
| 7 | Contraseña incorrecta | `POST /auth/login` → **401**, sin sesión y con el mensaje de error | ✅ |
| 8 | Cuenta bloqueada por el servidor tras 5 intentos | `POST /auth/login` → **423** y el frontend **no abre sesión** | ✅ (tras la corrección del §4) |
| 9 | Cierre de sesión | `POST /auth/logout` → **200** y el mismo token recibe **401** en `GET /auth/verify` | ✅ |
| 10 | El Administrador crea un usuario de Recepción en `/usuarios` | `POST /users` → **201**; la pantalla muestra la contraseña temporal una vez y el usuario nuevo **inicia sesión con ella** contra la API | ✅ (corrección de SCRUM-161) |
| 11 | Formulario de pacientes para Recepción | No aparecen las evaluaciones clínicas; se muestra el aviso de que las registra el personal clínico | ✅ (corrección de SCRUM-138) |

**11 de 11 pasos aprobados.** Los pasos 10 y 11 se agregaron al corregir SCRUM-161 y SCRUM-138; la ejecución de referencia es la del 28/10/2026 sobre `Sprint1`.

### Llamadas del frontend a la API durante el recorrido

```text
POST /auth/login → 200          (paso 1)
GET  /patients → 200            (paso 2)
POST /patients → 201            (paso 3)
POST /patients → 409            (paso 4)
POST /auth/login → 200          (paso 6, Voluntario)
POST /auth/login → 401          (paso 7)
POST /auth/login → 401 ×5, 423  (paso 8: bloqueo en el servidor)
POST /auth/login → 423          (paso 8: intento desde la pantalla)
POST /auth/logout → 200         (paso 9)
GET  /auth/verify → 401         (paso 9)
POST /users → 201               (paso 10: alta con contraseña temporal)
POST /auth/login → 200          (paso 10: el usuario nuevo inicia sesión)
GET  /patients → 200            (paso 11)
```

## 3. Capturas

| Paso | Captura |
| :--- | :--- |
| 1. Sesión del Administrador con la API | ![Login Administrador](./recorrido_integrado/01_login_admin_api.png) |
| 3. Ficha guardada y sincronizada | ![Alta de paciente](./recorrido_integrado/02_alta_paciente.png) |
| 5. Anamnesis visible para el Administrador | ![Anamnesis Administrador](./recorrido_integrado/03_anamnesis_admin.png) |
| 6. Anamnesis protegida para el Voluntario | ![Anamnesis protegida](./recorrido_integrado/04_anamnesis_protegida_voluntario.png) |
| 7. Contraseña incorrecta | ![Clave incorrecta](./recorrido_integrado/05_clave_incorrecta.png) |
| 8. Cuenta bloqueada por el servidor | ![Cuenta bloqueada](./recorrido_integrado/06_cuenta_bloqueada.png) |
| 10. Contraseña temporal mostrada una vez (base de pruebas desechable) | ![Contraseña temporal](./recorrido_integrado/07_contrasena_temporal.png) |
| 11. Formulario de Recepción sin campos clínicos | ![Formulario de Recepción](./recorrido_integrado/08_formulario_recepcion.png) |

## 4. Defecto encontrado y corregido

| Campo | Detalle |
| :--- | :--- |
| **Paso** | 8. Cuenta bloqueada por el servidor |
| **Esperado** | Si la API rechaza el login (401) o bloquea la cuenta (423), el frontend no debe abrir sesión |
| **Obtenido en la primera ejecución** | La API respondió **423**, pero el frontend abrió una **sesión local** con las contraseñas de demostración, saltándose el bloqueo del servidor |
| **Causa** | `signInWithApi` usaba el modo local ante **cualquier** error, incluso cuando la API sí había respondido |
| **Corrección** | `services/api.ts` lanza `ApiError` con el código HTTP. `signInWithApi` solo usa el modo local cuando la API **no responde**; si respondió, se respeta su decisión y se muestra su mensaje |
| **Prueba de regresión** | `LoginView.spec.ts` → «si la API bloquea la cuenta (423) no abre una sesión local» y «si la API no responde usa el modo local de respaldo» |
| **Verificación** | Segunda ejecución del recorrido: 9 de 9 ✅; ejecución final con los pasos 10 y 11: 11 de 11 ✅ |

## 5. Observaciones

- ✅ Resuelta: en el paso 6 el aviso 🔒 decía «requiere consentimiento… y estado Activo» aunque Elena Rojas sí los tiene. Ahora indica el motivo real: «Tu rol (Voluntario) no tiene acceso a los datos clínicos…» (captura 4).
- El bloqueo local del frontend (30 s) y el del servidor (15 min) tienen duraciones distintas. Al primer 423 manda el mensaje del servidor.

## 6. Cómo repetir el recorrido

```bash
# 1. Base de datos de pruebas (NUNCA la de Supabase) y API
cd Backend
DATABASE_URL=postgresql://usuario:clave@localhost:5432/aspar_e2e JWT_SECRET=secreto-local python -m scripts.migrate
DATABASE_URL=postgresql://usuario:clave@localhost:5432/aspar_e2e JWT_SECRET=secreto-local uvicorn app.main:app --port 8000

# 2. Frontend (otra terminal)
cd Frontend
cp .env.example .env
npm run dev

# 3. Recorrido (otra terminal)
cd Frontend
npm i --no-save playwright
npx playwright install chromium
node e2e/recorrido-integrado.cjs ../docs/evidencias/recorrido_integrado
```

El paso 8 deja bloqueada la cuenta `recepcion@aspar.org` durante 15 minutos y el paso 10 crea `sofia.morales@aspar.org`, así que cada ejecución necesita una base recién migrada.
