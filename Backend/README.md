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
| `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY` | Solo para documentos | Supabase → Project Settings → API Keys. La `service_role` es secreta: **solo** en este `.env`, nunca en el frontend. Sin ellas, `/patients/{id}/documents` responde 503. |

`.env` está en `.gitignore`; nunca lo subas al repositorio.

## 4. Base de datos y migraciones versionadas

Las migraciones son archivos `migrations/NNN_nombre.sql` que se aplican en orden. `scripts.migrate` guarda en la tabla `schema_migrations` la versión y el **SHA-256** de cada archivo, y toma un bloqueo (`pg_advisory_lock`) para que dos despliegues no migren a la vez.

| Migración | Contenido |
| :--- | :--- |
| `001_base.sql` | Esquema completo del Sprint 2 (25 tablas con UUID, límites de largo, baja lógica, RLS) y catálogos: roles, permisos y secciones del contenido. **No crea usuarios.** |

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
- Documentación interactiva (Swagger): <http://localhost:8000/docs>
- Especificación publicada en el repositorio: [`docs/api/openapi.json`](../docs/api/openapi.json). Si cambias un endpoint o un esquema, regénerala con `python -m scripts.export_openapi` (no necesita base de datos); `tests/test_openapi.py` falla si quedó desactualizada.

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
| Autenticación | `POST /auth/login`, `GET /auth/verify`, `POST /auth/refresh`, `POST /auth/logout` | Login público; resto con sesión |
| Afiliados | `GET/POST /patients`, `GET/PATCH /patients/{id}`, `POST /patients/{id}/deactivate`, `POST /patients/{id}/reactivate` | Lectura: personal con rol; edición: admin, coordination, professional, reception; baja y reactivación: admin |
| Documentos privados | `GET/POST /patients/{id}/documents`, `GET .../{doc}/url`, `DELETE .../{doc}` | Listar/descargar: personal clínico; subir: editores; borrar: admin |
| Usuarios y roles | `GET/POST /users`, `PATCH /users/{id}`, `POST /users/{id}/reset-password` | admin |
| Bitácora | `GET /audit?category=&severity=&actor=&from=&to=&limit=` | admin |

Los roles se identifican por su **clave fija** (`admin`, `coordination`, `professional`, `reception`, `volunteer`) y se muestran con su nombre (`Administración`, `Coordinación`...). Una cuenta sin rol está **Pendiente de aprobación**: puede iniciar sesión, pero no accede a ningún dato del panel. Las fichas no se borran: se dan de baja con un motivo y se pueden reactivar.

**Matriz de permisos por rol:**

| Acción | admin | coordination | professional | reception | volunteer |
| :--- | :---: | :---: | :---: | :---: | :---: |
| Ver lista y filiación de afiliados | ✅ | ✅ | ✅ | ✅ | ✅ |
| Ver anamnesis (con consentimiento y acceso Activo) | ✅ | ✅ | ✅ | ❌ | ❌ |
| Registrar/editar filiación y consentimiento | ✅ | ✅ | ✅ | ✅ | ❌ |
| Registrar síntomas y medicación | ✅ | ✅ | ✅ | ❌ | ❌ |
| Subir documentos | ✅ | ✅ | ✅ | ✅ | ❌ |
| Ver/descargar documentos | ✅ | ✅ | ✅ | ❌ | ❌ |
| Dar de baja fichas o eliminar documentos | ✅ | ❌ | ❌ | ❌ | ❌ |
| Usuarios, roles y bitácora | ✅ | ❌ | ❌ | ❌ | ❌ |

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
│   │   ├── network.py       #   IP real detrás de Cloud Run
│   │   ├── security.py      #   bcrypt y JWT
│   │   └── schemas.py       #   CamelModel y MessageResponse
│   ├── adapters/storage.py  # Supabase Storage (archivos privados)
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
