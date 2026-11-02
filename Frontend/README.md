# ASPAR Frontend — Sistema Web y de Gestión Clínica y Administrativa

Interfaz web tipo **Single Page Application (SPA)** desarrollada con **Vue 3 + TypeScript + Vite** por **Soluna Solutions** para la **Asociación de Parkinson "Mario Lagrava" (ASPAR)** en La Paz, Bolivia.

## 1. Requisitos del entorno

- **Node.js** `>= 20.19` (el CI usa Node 22) y **npm** `>= 10`.
- **API de ASPAR** corriendo (por ejemplo con `docker compose up -d` desde la raíz y `docker compose exec api python -m scripts.seed_demo` para las cuentas de prueba). El frontend ya no tiene un modo sin servidor para ingresar: la sesión es siempre la de la API.

## 2. Variables de entorno (`.env`)

```bash
cp .env.example .env
```

| Variable                  | Para qué                                                                               |
| :------------------------ | :------------------------------------------------------------------------------------- |
| `VITE_API_BASE_URL`       | URL de la API (por defecto `http://localhost:8000/api/v1`)                             |
| `VITE_GOOGLE_CLIENT_ID`   | ID de cliente OAuth de Google. Vacío: no aparece «Continuar con Google»                |
| `VITE_TURNSTILE_SITE_KEY` | Clave pública de Cloudflare Turnstile. En desarrollo, si falta, se usa la de prueba    |
| `VITE_DEMO_MODE`          | Solo para las pantallas antiguas que todavía no se migran (se elimina en el bloque F6) |

Los tiempos de sesión (30 min, 15 min sin uso, 8 h como máximo) los define la API.

## 3. Instalación y ejecución

```bash
cd Frontend
npm install
npm run dev        # http://localhost:5173
```

## 4. Scripts de calidad, pruebas y construcción

| Script                    | Comando                              | Propósito                                                    |
| :------------------------ | :----------------------------------- | :----------------------------------------------------------- |
| `npm run dev`             | `vite`                               | Servidor de desarrollo                                       |
| `npm run build`           | `vue-tsc -b && vite build`           | Verifica tipos (app, pruebas y E2E) y genera `dist/`         |
| `npm run lint`            | `eslint .`                           | ESLint + `typescript-eslint` + `eslint-plugin-vue`           |
| `npm run format`          | `prettier --write .`                 | Formato con `.prettierrc.json`                               |
| `npm run test:run`        | `vitest run`                         | Pruebas de componentes, vistas, router y composables         |
| `npm run test:coverage`   | `vitest run --coverage`              | Igual, con cobertura; falla por debajo de 70 % (RNF-05)      |
| `npm run e2e`             | `playwright test`                    | Recorridos de punta a punta contra la API real (ver abajo)   |
| `npm run api:types`       | `node scripts/api-types.mjs`         | Regenera `src/api/schema.d.ts` desde `docs/api/openapi.json` |
| `npm run api:types:check` | `node scripts/api-types.mjs --check` | Falla si `schema.d.ts` no coincide con el contrato (CI)      |

### Pruebas de punta a punta (Playwright)

```bash
# Desde la raíz: API y base con datos de demostración
docker compose up -d
docker compose exec api python -m scripts.seed_demo
# Desde Frontend/ (la primera vez, instala el navegador de pruebas)
npx playwright install chromium
npm run e2e
```

- Playwright construye el sitio y lo sirve con `vite preview` en `http://localhost:4173` (origen permitido por la API de `docker compose`).
- Todo va contra la API real. Solo los scripts de Cloudflare Turnstile y de Google se reemplazan por dobles en el navegador.
- `E2E_EVIDENCIAS=<carpeta> npm run e2e` guarda las capturas de `docs/evidencias/`.
- La API limita los ingresos (10 por cuenta y 30 por IP cada 15 minutos) y los registros (5 por hora). Si se corre el recorrido muchas veces seguidas, espera o limpia los contadores de tu base local: `docker compose exec db psql -U aspar -d aspar -c "delete from rate_limits"`.

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
  const page = await api.patients.list({
    search: 'rojas',
    limit: 20,
    offset: 0,
  })
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
- **Cobertura del contrato**: la capa tiene un método para cada operación de `docs/api/openapi.json`. `src/api/__test__/endpoints.spec.ts` lo verifica: falla si un endpoint del Backend no tiene su método aquí o si un método llama a una ruta que no existe.

| Grupo                                                              | Para qué                                                                                           |
| :----------------------------------------------------------------- | :------------------------------------------------------------------------------------------------- |
| `api.auth`                                                         | Login con contraseña o Google, sesión, registro, verificación y recuperación, cambio de contraseña |
| `api.patients`, `api.contacts`, `api.evaluations`, `api.documents` | Fichas, familiares o cuidadores, evaluaciones de seguimiento y documentos privados                 |
| `api.users`, `api.roles`                                           | Equipo, cuentas pendientes y matriz de permisos                                                    |
| `api.schedules`, `api.attendance`                                  | Agenda y toma de asistencia (con el resumen mensual en CSV o Excel)                                |
| `api.inventory`                                                    | Materiales, movimientos, bajas y exportación para la Alcaldía                                      |
| `api.donations`                                                    | Registro de aportes, confirmación con el extracto, aportes en la sede y meta                       |
| `api.media`, `api.content`                                         | Galería con subida firmada a Cloudinary y contenido del sitio                                      |
| `api.inquiries`, `api.dashboard`                                   | Bandeja de solicitudes, inscripción como afiliado y resumen del panel                              |
| `api.audit`, `api.system`                                          | Bitácora y estado de la API                                                                        |
| `api.public`                                                       | Lo que usa el sitio sin sesión: agenda, meta y avisos de aporte, galería, contenido y solicitudes  |

## 5. Cuentas de prueba (`seed_demo`)

| Rol                     | Correo                   | Contraseña         | Qué ve                                                                                                |
| :---------------------- | :----------------------- | :----------------- | :---------------------------------------------------------------------------------------------------- |
| Administración          | `admin@aspar.org`        | `Admin2026!`       | Todo el espacio del equipo                                                                            |
| Coordinación            | `coordinacion@aspar.org` | `Coord2026!`       | Afiliados con historia clínica, actividades, inventario, donaciones, galería, contenido y solicitudes |
| Profesional             | `profesional@aspar.org`  | `Profesional2026!` | Afiliados con historia clínica y asistencia                                                           |
| Recepción               | `recepcion@aspar.org`    | `Recep2026!`       | Afiliados (sin historia clínica), asistencia, donaciones y solicitudes                                |
| Voluntariado            | `voluntario@aspar.org`   | `Voluntario2026!`  | Afiliados (datos de contacto) y asistencia                                                            |
| Pendiente de aprobación | `pendiente@aspar.org`    | `Pendiente2026!`   | La pantalla de espera y el sitio público                                                              |

## 6. Diseño y estructura

El diseño sigue `ASPAR_diseno_completo.pdf`: paleta oficial (Verde ASPAR `#073930`, Guindo `#6D1619`, Rojo `#AB1A1C`, Rosa suave `#F6E7E3`, Crema `#F5F1EA`), Lora para titulares y Source Sans 3 para la interfaz (servidas desde el propio sitio). Todo color, sombra y espacio sale de `src/styles/tokens.css`.

| Ruta                                           | Pantalla                                                              | Acceso                                     |
| :--------------------------------------------- | :-------------------------------------------------------------------- | :----------------------------------------- |
| `/`                                            | Sitio público (portada actual; se rehace en F5b)                      | Todos                                      |
| `/ingresar`                                    | Acceso del equipo: correo y contraseña o Google                       | Sin sesión                                 |
| `/crear-cuenta`, `/recuperar-contrasena`       | Registro y recuperación, con Turnstile                                | Sin sesión                                 |
| `/verificar-correo`, `/restablecer-contrasena` | Enlaces de los correos                                                | Todos                                      |
| `/cambiar-contrasena`                          | Contraseña propia (obligatoria con la temporal)                       | Con sesión                                 |
| `/cuenta-pendiente`                            | Espera de la aprobación de Administración                             | Cuenta sin rol                             |
| `/equipo` y `/equipo/*`                        | Espacio del equipo: resumen y una ruta por sección                    | Según los permisos del rol                 |
| `/equipo/afiliados`                            | Listado con pestañas, filtros, páginas y alta                         | `patients:read`                            |
| `/equipo/afiliados/:id`                        | Ficha: datos, historia clínica, evaluaciones, asistencia y documentos | `patients:read` (lo clínico, según RNF-06) |

```text
Frontend/
├── e2e/                         # Recorridos Playwright contra la API real
├── playwright.config.ts
├── src/
│   ├── api/                     # Contrato con la API: cliente, endpoints tipados y sesión
│   ├── styles/                  # tokens.css, base.css, forms.css (y legacy.css de la portada actual)
│   ├── components/
│   │   ├── ui/                  # Botón, modal, aviso, insignia, tabla, esqueleto, campos, toasts
│   │   ├── auth/                # Turnstile, Google, reglas de contraseña, formulario de correo
│   │   ├── patients/            # Alta de afiliados, campos de contacto y pestañas de la ficha (record/)
│   │   └── session/             # Aviso de inactividad
│   ├── composables/             # useApi, useToast, useIdleSession, usePageCrumb
│   ├── layouts/                 # TeamLayout (barra lateral), AuthLayout (acceso), PublicLayout
│   ├── router/                  # Rutas, secciones del equipo y reglas de acceso (guards.ts)
│   ├── utils/                   # Fechas en hora de Bolivia, validaciones, afiliados, paginación
│   ├── views/
│   │   ├── auth/                # Ingreso, registro, correo, contraseñas, cuenta pendiente
│   │   ├── team/                # Resumen, afiliados (patients/) y secciones en preparación
│   │   └── *.vue                # Pantallas antiguas (modo demo), sin ruta: se reemplazan bloque a bloque
│   └── services/, types/        # Capa antigua del modo demo; se elimina en F6
└── src/**/__test__/             # Pruebas de Vitest junto a cada parte
```

**Sesión:** la cookie HttpOnly y el token CSRF los maneja `src/api`. `useIdleSession` avisa a los 13 minutos sin uso («¿Sigues ahí?»), renueva la sesión mientras la persona trabaja y la cierra a los 15. La actividad se comparte entre pestañas.

**Secciones en preparación:** las pantallas que aún no se conectan a la API muestran «Estamos preparando esta sección» en lugar de datos de ejemplo. Cada bloque las reemplaza por la vista real; F2 ya conectó Afiliados.

**Encabezados fijos:** la página tiene una sola barra de desplazamiento. Cada pantalla pone su encabezado (título, pestañas, filtros) dentro de `StickyHeader`, que queda fijo al bajar y avisa con `stuck` para achicarlo; las tablas usan `DataTable` con `sticky-head` para que los títulos de las columnas queden justo debajo. `StickyHeader` debe ser hijo directo del contenedor de toda la vista. Al cambiar de pestaña o de página, `scrollToStart()` deja la lista justo bajo el encabezado.

**Afiliados (F2):** pestaña, búsqueda, filtro, orden y página quedan en la dirección (`?pestana=activos&buscar=…&pagina=2`), así «‹ Afiliados» desde una ficha vuelve al mismo lugar. La ficha guarda los datos personales y el consentimiento con «Guardar ficha»; cada familiar, evaluación o documento se guarda al momento. Lo clínico (historia, evaluaciones y documentos) solo aparece si la API lo envía: si no, la ficha explica el motivo real (rol, consentimiento o acceso suspendido). Las tablas pasan a tarjetas según su propio ancho, para que nunca haya desplazamiento lateral.
