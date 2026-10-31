# Backend ASPAR — API REST FastAPI + Supabase PostgreSQL

API del Sistema Web y de Gestión de la Asociación de Parkinson "Mario Lagrava" (ASPAR). Cada dominio es un módulo con las capas del diagrama C3 (**router → service → repository → PostgreSQL**), con JWT, bitácora de auditoría y adaptador de Supabase Storage ([ADR-011](../docs/arquitectura/adr/ADR-011-backend-por-modulos-de-dominio.md)).

## 1. Requisitos

| Herramienta | Versión | Nota |
| :--- | :--- | :--- |
| Python | **3.12 o superior** | Python 3.9/3.10 no sirve: SQLAlchemy 2.1 y psycopg2-binary 2.9.13 lo exigen |
| Proyecto Supabase | Plan Free | Base PostgreSQL + Storage |
| Git | — | — |

La forma recomendada de trabajar es con Docker desde la raíz del repositorio (`docker compose up --build`, ver el [README principal](../README.md)). El [`Dockerfile`](./Dockerfile) tiene dos etapas: `dev` (la usa `docker-compose.yml`, con recarga automática) y `runtime` (la imagen que se despliega en Google Cloud Run, con usuario sin privilegios y el puerto de `$PORT`). Lo que sigue es la instalación sin Docker.

## 2. Instalación

Desde la carpeta `Backend`:

```bash
python3.12 -m venv .venv
source .venv/bin/activate
pip install -r requirements-dev.txt
```

En Windows, la activación es `.venv\Scripts\activate`. En zsh (macOS), no pegues comentarios `# ...` en la misma línea de un comando: zsh los toma como argumentos.

## 3. Variables de entorno

```bash
cp .env.example .env
```

| Variable | Obligatoria | Descripción |
| :--- | :--- | :--- |
| `DATABASE_URL` | Sí | Supabase → **Connect** → **Transaction pooler** (puerto 6543, IPv4) para la API. Reemplaza `[YOUR-PASSWORD]` **sin corchetes**. La conexión directa `db.<ref>.supabase.co` usa IPv6 y suele fallar en redes domésticas. |
| `MIGRATION_DATABASE_URL` | No | Supabase → **Session pooler** (puerto 5432) para `scripts.migrate`. Si se omite, las migraciones usan `DATABASE_URL`. |
| `ENV` | No | `dev` (por defecto), `test` o `prod`. |
| `LOG_LEVEL` | No | `INFO` por defecto. Los logs salen en JSON, una línea por evento, con el `request_id` de cada petición. |
| `DB_POOL` | No | `queue` (por defecto, base directa o Docker) o `null` con el Transaction Pooler de Supabase. |
| `PROXY_TRUSTED_HOPS` | No | `0` en tu PC y en Docker; `1` en Google Cloud Run. Indica cuántas IP del final de `X-Forwarded-For` agregaron nuestros proxies (ver `app/core/network.py`). |
| `JWT_SECRET` | Sí | Mínimo 32 caracteres: `python -c "import secrets; print(secrets.token_urlsafe(32))"`. La API no arranca con el valor de ejemplo. |
| `SESSION_MAX_AGE_SECONDS` | No | Duración máxima de la sesión (por defecto 1800 = 30 min). |
| `SESSION_IDLE_LIMIT_SECONDS` | No | Inactividad permitida (por defecto 900 = 15 min). |
| `SESSION_ABSOLUTE_MAX_SECONDS` | No | Tope absoluto de una sesión aunque se renueve (por defecto 28800 = 8 h). |
| `CORS_ORIGINS` | No | Orígenes del frontend separados por coma (por defecto `http://localhost:5173`). |
| `FRONTEND_URL`, `EMAIL_PROVIDER`, `EMAIL_FROM`, `RESEND_API_KEY` / `BREVO_API_KEY` | No (sí en prod) | Correos de verificación y recuperación. En desarrollo (`console`) el correo, con su enlace, aparece en los logs de la API. |
| `TURNSTILE_SECRET_KEY` | No (sí en prod) | CAPTCHA de Cloudflare para registro y recuperación. Vacío = clave de prueba que siempre aprueba. |
| `GOOGLE_CLIENT_ID` | No | Activa «Continuar con Google». |
| `COOKIE_DOMAIN`, `COOKIE_SECURE`, `COOKIE_SAMESITE` | No | Cookies de sesión. Producción: `COOKIE_DOMAIN=.aspar.com`, `COOKIE_SECURE=true`. En Docker local `COOKIE_SECURE=false` (http). |
| `RATE_LIMITS_ENABLED` | No | `true` por defecto: limita login, registro y correos por IP y por cuenta (tabla `rate_limits`). Solo los tests lo apagan; en prod es obligatorio. |
| `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY` | Solo para documentos | Supabase → Project Settings → API Keys. La `service_role` es secreta: **solo** en este `.env`, nunca en el frontend. Sin ellas, `/patients/{id}/documents` responde 503. |

`.env` está en `.gitignore`; nunca lo subas al repositorio.

## 4. Base de datos y migraciones versionadas

Las migraciones son archivos `migrations/NNN_nombre.sql` que se aplican en orden. `scripts.migrate` guarda en la tabla `schema_migrations` la versión y el **SHA-256** de cada archivo, y toma un bloqueo (`pg_advisory_lock`) para que dos despliegues no migren a la vez.

| Migración | Contenido |
| :--- | :--- |
| `001_base.sql` | Esquema completo del Sprint 2 (25 tablas con UUID, límites de largo, baja lógica, RLS) y catálogos: roles, permisos y secciones del contenido. **No crea usuarios.** |
| `002_busqueda_trigram.sql` | Extensión `pg_trgm` (esquema `extensions`) e índices GIN de trigramas para buscar por fragmentos: afiliados por nombre y CI, equipo por nombre y correo, bitácora por actor. |

```bash
python -m scripts.migrate            # aplica las pendientes
python -m scripts.migrate --status   # aplicada / PENDIENTE / MODIFICADA
```

- Con Docker se aplican solas al arrancar la API. En Supabase usa `MIGRATION_DATABASE_URL` (Session Pooler, puerto 5432).
- **Nunca edites una migración aplicada en una base compartida**: crea la siguiente (`002_...sql`). Si el checksum no coincide, `scripts.migrate` se detiene y explica qué pasó.
- **Base local del Sprint 1:** la `001_base.sql` reemplazó a las migraciones anteriores. Si `scripts.migrate` avisa que la base tiene `001_initial_schema.sql`, reinicia la base de Docker con `docker compose down -v` y `docker compose up --build`.

## 5. Ejecutar la API

```bash
uvicorn app.main:app --reload
```

- Salud: <http://localhost:8000/api/v1/health> y <http://localhost:8000/api/v1/health/db>
- Documentación interactiva (Swagger): <http://localhost:8000/docs> (solo en `dev` y `test`: con `ENV=prod` no se publican `/docs`, `/redoc` ni `/openapi.json`)
- Especificación publicada en el repositorio: [`docs/api/openapi.json`](../docs/api/openapi.json). Si cambias un endpoint o un esquema, regénerala con `python -m scripts.export_openapi` (no necesita base de datos); `tests/test_openapi.py` falla si quedó desactualizada. Después regenera los tipos del frontend con `npm run api:types` (desde `Frontend/`): el CI del frontend falla si no coinciden.

### 5.1 Cuentas: ninguna vive en el código

| Para qué | Comando | Dónde |
| :--- | :--- | :--- |
| Primera cuenta de **Administración** (correo oficial de ASPAR) | `python -m scripts.create_admin` | Cualquier base, una sola vez. Pide nombre, correo y contraseña (dos veces, sin mostrarla). `--promote --email x` da el rol a una cuenta que ya existe. |
| Datos de **demostración** | `python -m scripts.seed_demo` | Solo desarrollo y pruebas: **bloqueado con `ENV=prod`**. |

Cuentas que crea `seed_demo` (contraseñas públicas, solo para tu PC):

| Correo | Contraseña | Rol |
| :--- | :--- | :--- |
| `admin@aspar.org` | `Admin2026!` | Administración |
| `coordinacion@aspar.org` | `Coord2026!` | Coordinación |
| `profesional@aspar.org` | `Profesional2026!` | Profesional |
| `recepcion@aspar.org` | `Recep2026!` | Recepción |
| `voluntario@aspar.org` | `Voluntario2026!` | Voluntariado |
| `pendiente@aspar.org` | `Pendiente2026!` | Pendiente de aprobación (sin rol) |

Con Docker: `docker compose exec api python -m scripts.seed_demo` (o `make seed`) y `docker compose exec api python -m scripts.create_admin` (o `make create-admin`).

## 6. Endpoints (`/api/v1`)

| Grupo | Rutas | Roles |
| :--- | :--- | :--- |
| Sistema | `GET /health` (prueba de vida, sin base), `GET /health/db` (conexión con PostgreSQL) | Público |
| Autenticación | `POST /auth/login`, `POST /auth/google`, `GET /auth/me`, `POST /auth/refresh`, `POST /auth/logout` | Login público; resto con sesión |
| Cuentas | `POST /auth/register`, `POST /auth/verify-email`, `POST /auth/resend-verification`, `POST /auth/forgot-password`, `POST /auth/reset-password`, `POST /auth/change-password` | Públicos (con Turnstile los que envían correos); `change-password` con sesión |
| Afiliados | `GET /patients?search=&status=&includeInactive=&limit=&offset=`, `POST /patients`, `GET/PATCH /patients/{id}`, `POST /patients/{id}/deactivate`, `POST /patients/{id}/reactivate` | Lectura: personal con rol; edición: admin, coordination, professional, reception; baja y reactivación: admin |
| Documentos privados | `GET/POST /patients/{id}/documents`, `GET .../{doc}/url`, `DELETE .../{doc}` | Listar/descargar: personal clínico; subir: editores; borrar: admin |
| Usuarios y roles | `GET /users?search=&limit=&offset=`, `POST /users`, `PATCH /users/{id}`, `POST /users/{id}/reset-password` | admin |
| Bitácora | `GET /audit?category=&severity=&actor=&from=&to=&limit=&offset=` | admin |

**Listados paginados.** `GET /patients`, `GET /users` y `GET /audit` responden siempre con el mismo sobre:

```json
{ "items": [ ... ], "total": 137, "limit": 50, "offset": 0 }
```

`limit` va de 1 a 200 (por defecto 50) y `offset` desde 0; `total` cuenta todas las filas que cumplen los filtros, para armar el paginador. El orden es estable (termina en el `id`), así que recorrer las páginas nunca repite ni salta filas. Las búsquedas (`search`, `actor`) encuentran fragmentos en cualquier parte del texto, sin distinguir mayúsculas, y usan los índices de `002_busqueda_trigram.sql`.

**Sesión con cookies.** El login responde con dos cookies: `aspar_session` (el JWT, `HttpOnly`, `Secure`, `SameSite=Lax`, solo para `/api`: JavaScript no puede leerla) y `aspar_csrf` (legible). El frontend envía las peticiones con `credentials: 'include'` y, en todo `POST/PUT/PATCH/DELETE`, repite el valor de `aspar_csrf` en el encabezado `X-CSRF-Token`; sin él la API responde 403. Además se rechaza cualquier petición que modifique datos con un `Origin` que no esté en `CORS_ORIGINS`. El token dura 30 minutos (renovable con `/auth/refresh`), la sesión se cierra a los 15 minutos sin actividad y nunca dura más de 8 horas.

**Cuentas.** Hay tres formas de tener cuenta:

1. **Invitación de Administración** (`POST /users`): la API genera una contraseña temporal legible (`Palabra-4Dígitos-Palabra`, aleatoria cada vez) que vence en `TEMP_PASSWORD_HOURS`. Hasta cambiarla con `/auth/change-password`, la cuenta no accede a ningún dato.
2. **Registro abierto** (`/auth/register`, con Turnstile): la cuenta nace sin rol y no puede ingresar hasta confirmar el correo con el enlace que recibe.
3. **Continuar con Google** (`/auth/google`): se exige `email_verified` en Google. Si el correo ya existe y está confirmado, se vincula; si existe sin confirmar, **no** se vincula (409), para que nadie se apropie de una cuenta registrada con un correo ajeno.

Las respuestas de registro y recuperación son iguales exista o no el correo. Los correos salen solo después de confirmar la transacción.

Los roles se identifican por su **clave fija** (`admin`, `coordination`, `professional`, `reception`, `volunteer`) y se muestran con su nombre (`Administración`, `Coordinación`...). Una cuenta sin rol está **Pendiente de aprobación**: puede iniciar sesión, pero no accede a ningún dato del panel. Las fichas no se borran: se dan de baja con un motivo y se pueden reactivar.

**Permisos dinámicos.** Cada endpoint exige uno o más permisos (`require_permission("patients:write")`), y cada rol los tiene asignados en la tabla `role_permissions`: Administración podrá cambiarlos desde el panel (Bloque 4) sin tocar código. El rol del sistema `admin` siempre tiene todos los permisos y la base impide quitárselos o cambiar su clave. La anamnesis y los documentos exigen además, siempre, **consentimiento firmado y acceso Activo** (RNF-06), aunque un rol tenga el permiso clínico. `GET /auth/me` devuelve la lista `permissions` para que el frontend muestre solo los menús que corresponden. Las 17 claves son fijas (`PERMISSION_KEYS` en `app/modules/users/models.py`) y se publican en OpenAPI como enumeración, así el frontend las recibe tipadas; `tests/test_permissions.py` verifica que coincidan con la tabla `permissions`.

| Permiso | Para qué | admin | coordination | professional | reception | volunteer |
| :--- | :--- | :---: | :---: | :---: | :---: | :---: |
| `patients:read` | Ver afiliados y su contacto | ✅ | ✅ | ✅ | ✅ | ✅ |
| `patients:write` | Registrar y editar fichas y consentimiento | ✅ | ✅ | ✅ | ✅ | ❌ |
| `patients:read_clinical` ⚠️ | Ver anamnesis, evaluaciones y documentos | ✅ | ✅ | ✅ | ❌ | ❌ |
| `patients:write_clinical` ⚠️ | Registrar síntomas, medicación y evaluaciones | ✅ | ✅ | ✅ | ❌ | ❌ |
| `patients:deactivate` ⚠️ | Dar de baja o reactivar fichas | ✅ | ❌ | ❌ | ❌ | ❌ |
| `documents:upload` | Subir documentos privados | ✅ | ✅ | ✅ | ✅ | ❌ |
| `documents:delete` ⚠️ | Eliminar documentos privados | ✅ | ❌ | ❌ | ❌ | ❌ |
| `attendance:write` | Tomar asistencia | ✅ | ✅ | ✅ | ✅ | ✅ |
| `schedules:manage` | Actividades | ✅ | ✅ | ❌ | ❌ | ❌ |
| `inventory:manage` | Inventario | ✅ | ✅ | ❌ | ❌ | ❌ |
| `donations:manage` | Donaciones y meta | ✅ | ✅ | ❌ | ✅ | ❌ |
| `inquiries:manage` | Solicitudes | ✅ | ✅ | ❌ | ✅ | ❌ |
| `media:manage` | Galería | ✅ | ✅ | ❌ | ❌ | ❌ |
| `content:manage` | Contenido del sitio | ✅ | ✅ | ❌ | ❌ | ❌ |
| `users:manage` ⚠️ | Equipo, aprobación de cuentas y roles | ✅ | ❌ | ❌ | ❌ | ❌ |
| `roles:manage` ⚠️ | Cambiar los permisos de los roles | ✅ | ❌ | ❌ | ❌ | ❌ |
| `audit:read` ⚠️ | Registro de actividad | ✅ | ❌ | ❌ | ❌ | ❌ |

⚠️ = permiso sensible (`permissions.is_sensitive`): el panel advierte antes de dárselo a otro rol. Valores iniciales tomados de la tabla «Qué puede ver cada rol» del diseño.

**Endurecimiento.**

- **Límites de peticiones** (respuesta `429` con `Retry-After`), contados por IP real y por cuenta en la tabla `rate_limits`, en su propia transacción para que un login fallido igual quede contado: login 30/15 min por IP y 10/15 min por cuenta; Google 30/15 min por IP; registro 5/h por IP; correos de verificación y recuperación 5/h por IP y 3/h por correo; enlaces 20/h por IP.
- **Login uniforme**: correo inexistente, contraseña incorrecta, cuenta inactiva o bloqueada responden igual (`401` con el mismo mensaje y el mismo tiempo de bcrypt). Tras 5 fallos la cuenta se bloquea 15 minutos.
- **Bitácora agrupada**: los intentos fallidos y los accesos bloqueados repetidos dentro de 15 minutos suman `occurrences` en una sola fila (con `lastOccurredAt`) en vez de llenar la bitácora; el bloqueo de una cuenta queda como evento `CRITICAL` aparte.
- **Datos clínicos**: `GET /patients` devuelve un resumen **sin anamnesis**; la ficha completa solo sale por `GET /patients/{id}`, que queda en la bitácora. Listar o descargar documentos exige la misma regla de consentimiento que la anamnesis. Al subir un archivo se comprueba que su contenido real (firma de bytes) coincide con el tipo declarado.
- **Búsquedas**: `%`, `_` y `\` se buscan como texto, no como comodines.
- **Perímetro HTTP**: cabeceras `X-Content-Type-Options`, `X-Frame-Options: DENY`, `Referrer-Policy`, `Permissions-Policy`, `Content-Security-Policy` y `Cache-Control: no-store` en la API; `Strict-Transport-Security` en prod. CORS solo para `CORS_ORIGINS` (https en prod) y los encabezados `Content-Type`, `X-CSRF-Token` y `X-Request-ID`.
- **Producción**: la API no arranca con `ENV=prod` si el correo es `console`, Turnstile usa la clave de prueba, `COOKIE_SECURE=false`, `RATE_LIMITS_ENABLED=false` o algún origen CORS no es https.

## 7. Calidad: Ruff y pytest

```bash
ruff check .
ruff format --check .
pytest
pytest --cov=app --cov-report=term-missing   # cobertura (mínimo 70%, RNF-05)
```

- Sin más configuración, `pytest` ejecuta las **pruebas unitarias** (seguridad, migraciones, mapeos, contrato, adaptador de Storage) y omite las que necesitan base de datos.
- Las **pruebas de API** necesitan un PostgreSQL **dedicado a pruebas**, porque borran y recrean su esquema `public`: `TEST_DATABASE_URL=postgresql://usuario:clave@localhost:5432/aspar_test pytest`. Por seguridad, las pruebas se niegan a correr si la URL apunta a Supabase. En GitHub Actions se ejecutan siempre (ver `.github/workflows/ci-backend.yml`).

## 8. Estructura

```
Backend/
├── app/
│   ├── main.py              # App FastAPI: middlewares (request_id, CORS), errores y routers
│   ├── models.py            # Registro de todos los modelos ORM
│   ├── core/                # Compartido por todos los módulos
│   │   ├── config.py        #   configuración tipada (pydantic-settings)
│   │   ├── database.py      #   motor, unidad de trabajo por petición (DbSession)
│   │   ├── errors.py        #   errores de dominio y respuestas {"detail": ...}
│   │   ├── logging.py       #   logs JSON con request_id
│   │   ├── middleware.py    #   cabeceras de seguridad y control de Origin
│   │   ├── network.py       #   IP real detrás de Cloud Run
│   │   ├── pagination.py    #   ?limit=&offset= y sobre {items, total, limit, offset}
│   │   ├── rate_limit.py    #   límites de peticiones (tabla rate_limits)
│   │   ├── security.py      #   bcrypt y JWT
│   │   └── schemas.py       #   CamelModel y MessageResponse
│   ├── adapters/            # Servicios externos: Storage, correo, Turnstile y Google
│   └── modules/             # Un módulo por dominio, siempre con la misma plantilla:
│       ├── auth/            #   router.py   endpoints HTTP y permisos
│       ├── users/           #   service.py  reglas de negocio y bitácora
│       ├── patients/        #   repository.py consultas
│       ├── documents/       #   schemas.py  DTOs de entrada y salida
│       └── audit/           #   models.py   tabla ORM y valores de dominio
├── migrations/              # SQL versionado (NNN_nombre.sql)
├── scripts/                 # migrate, export_openapi, create_admin, seed_demo
├── tests/                   # pytest
├── Dockerfile               # Etapas dev (docker compose) y runtime (Cloud Run)
├── pyproject.toml           # Configuración de Ruff y pytest
├── requirements.txt         # Dependencias de ejecución
└── requirements-dev.txt     # + pytest y ruff
```

`auth/` tiene además `dependencies.py` (`get_current_user`, `require_roles`). Para agregar un dominio nuevo, crea `app/modules/<dominio>/` con los cinco archivos y registra su router en `main.py`.

## 9. Problemas frecuentes

| Síntoma | Causa y solución |
| :--- | :--- |
| `No module named 'psycopg'` | Código antiguo: `app/core/database.py` debe convertir la URL a `postgresql+psycopg2://` (ya incluido). |
| `could not translate host name "db.<ref>.supabase.co"` | Conexión directa IPv6: usa la cadena del **Session pooler**. |
| `password authentication failed` | La contraseña quedó con corchetes `[ ]` o tiene caracteres especiales sin codificar (`@` → `%40`). |
| `ValidationError ... JWT_SECRET debe ser...` al arrancar | Genera un secreto propio de 32+ caracteres en `.env`. La configuración (`app/core/config.py`) se valida al iniciar: si falta una variable obligatoria o tiene un formato inválido, la API no arranca y el mensaje dice cuál es. |
| Un error 500 con «código …» | Busca ese código (`request_id`) en los logs de la API: ahí está el detalle técnico, que nunca se envía al navegador. |
| `ResolutionImpossible ... protobuf` al instalar | Estás usando el `requirements.txt` antiguo en UTF-16; usa el de esta carpeta. |
| `401 La sesión expiró por inactividad` | Pasaron 15 minutos sin peticiones; inicia sesión otra vez. |
| `429 Demasiados intentos` | Se superó un límite de peticiones; espera los segundos que indica `Retry-After`. En local puedes vaciar la tabla: `docker compose exec db psql -U aspar -d aspar -c "delete from rate_limits"`. |
