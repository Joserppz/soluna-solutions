# Backend ASPAR — API REST FastAPI + Supabase PostgreSQL

API del Sistema Web y de Gestión de la Asociación de Parkinson "Mario Lagrava" (ASPAR). Sigue el diagrama C3 del proyecto: **routers → services → repositories → PostgreSQL (Supabase)**, con JWT, bitácora de auditoría y adaptador de Supabase Storage.

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
| `JWT_SECRET` | Sí | Mínimo 32 caracteres: `python -c "import secrets; print(secrets.token_urlsafe(32))"`. La API no arranca con el valor de ejemplo. |
| `SESSION_MAX_AGE_SECONDS` | No | Duración máxima de la sesión (por defecto 1800 = 30 min). |
| `SESSION_IDLE_LIMIT_SECONDS` | No | Inactividad permitida (por defecto 900 = 15 min). |
| `CORS_ORIGINS` | No | Orígenes del frontend separados por coma (por defecto `http://localhost:5173`). |
| `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY` | Solo para documentos | Supabase → Project Settings → API Keys. La `service_role` es secreta: **solo** en este `.env`, nunca en el frontend. Sin ellas, `/patients/{id}/documents` responde 503. |

`.env` está en `.gitignore`; nunca lo subas al repositorio.

## 4. Base de datos y migraciones versionadas

Las migraciones son archivos `migrations/NNN_nombre.sql` que se aplican en orden y se registran en la tabla `schema_migrations`.

| Migración | Contenido |
| :--- | :--- |
| `001_initial_schema.sql` | 10 tablas, RLS, triggers, usuarios iniciales y datos de demostración |
| `002_patient_documents.sql` | Documentos privados de pacientes y bucket privado `documentos-pacientes` |

**Base nueva (vacía):**

```bash
python -m scripts.migrate
```

**Base donde ya se ejecutó la 001 a mano en el SQL Editor** (caso del proyecto Supabase actual):

```bash
python -m scripts.migrate --baseline 001
python -m scripts.migrate
```

El primer comando registra la 001 como aplicada sin ejecutarla; el segundo aplica la 002. Para ver el estado: `python -m scripts.migrate --status`.

**Regla:** nunca edites una migración ya aplicada; crea la siguiente (`003_...sql`).

## 5. Ejecutar la API

```bash
uvicorn app.main:app --reload
```

- Salud: <http://localhost:8000/api/v1/health>
- Documentación interactiva (Swagger): <http://localhost:8000/docs>
- Especificación publicada en el repositorio: [`docs/api/openapi.json`](../docs/api/openapi.json). Si cambias un endpoint o un esquema, regénerala con `python -m scripts.export_openapi` (no necesita base de datos); `tests/test_openapi.py` falla si quedó desactualizada.

**Usuarios iniciales** (migración 001; rota sus contraseñas antes de producción, ver 5.1):

| Correo | Rol |
| :--- | :--- |
| `dayana.rojas@ucb.edu.bo`, `jose.rodriguez.p@ucb.edu.bo` | Administrador |
| `admin@aspar.org` | Administrador |
| `coordinacion@aspar.org` | Coordinador |
| `demo@aspar.org` | Profesional |
| `recepcion@aspar.org` | Recepción |
| `voluntario@aspar.org` | Voluntario |

### 5.1 Antes de usar datos reales: rotar las contraseñas iniciales

Las contraseñas de estas cuentas están escritas en la migración 001, así que **cualquiera que lea el repositorio puede entrar**. En la base de producción (Supabase), ejecuta una vez:

```bash
python -m scripts.rotar_contrasenas_iniciales --dry-run   # lista las cuentas que siguen con la contraseña inicial
python -m scripts.rotar_contrasenas_iniciales             # las cambia por contraseñas aleatorias
```

- Las contraseñas nuevas se muestran **una sola vez**: entrégalas a cada persona por un canal privado.
- Se cierran las sesiones de esas cuentas y cada cambio queda en la bitácora (`Rotación de contraseña inicial`).
- Volver a ejecutarlo no modifica cuentas que ya se rotaron. Una cuenta de demostración que no se vaya a usar se puede **desactivar** desde `/usuarios`.

## 6. Endpoints (`/api/v1`)

| Grupo | Rutas | Roles |
| :--- | :--- | :--- |
| Sistema | `GET /health` | Público |
| Autenticación | `POST /auth/login`, `GET /auth/verify`, `POST /auth/refresh`, `POST /auth/logout` | Login público; resto con sesión |
| Pacientes | `GET/POST /patients`, `GET/PATCH/DELETE /patients/{id}` | Lectura: todos; edición: Administrador, Coordinador, Profesional, Recepción; borrado: Administrador |
| Documentos privados | `GET/POST /patients/{id}/documents`, `GET .../{doc}/url`, `DELETE .../{doc}` | Listar/descargar: personal clínico; subir: editores; borrar: Administrador |
| Usuarios y roles | `GET/POST /users`, `PATCH /users/{id}`, `POST /users/{id}/reset-password` | Administrador |
| Bitácora | `GET /audit?category=&severity=&actor=&from=&to=&limit=` | Administrador |

El contrato detallado con el frontend está en [`docs/api/CONTRATO_API_LOGIN_PACIENTES.md`](../docs/api/CONTRATO_API_LOGIN_PACIENTES.md).

**Matriz de permisos por rol:**

| Acción | Administrador | Coordinador | Profesional | Recepción | Voluntario |
| :--- | :---: | :---: | :---: | :---: | :---: |
| Ver lista y filiación de pacientes | ✅ | ✅ | ✅ | ✅ | ✅ |
| Ver anamnesis (con consentimiento y acceso Activo) | ✅ | ✅ | ✅ | ❌ | ❌ |
| Registrar/editar filiación y consentimiento | ✅ | ✅ | ✅ | ✅ | ❌ |
| Registrar síntomas, evaluaciones y medicación | ✅ | ✅ | ✅ | ❌ | ❌ |
| Subir documentos de pacientes | ✅ | ✅ | ✅ | ✅ | ❌ |
| Ver/descargar documentos de pacientes | ✅ | ✅ | ✅ | ❌ | ❌ |
| Eliminar pacientes o documentos | ✅ | ❌ | ❌ | ❌ | ❌ |
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
│   ├── main.py            # App FastAPI, CORS, manejadores de error y routers
│   ├── core/              # config (.env), database, security (bcrypt/JWT), deps (sesión y roles),
│   │                      # constants (roles, estados) y errors (422 en texto)
│   ├── models/            # SQLAlchemy: User, UserSession, Patient, PatientDocument, AuditLog
│   ├── schemas/           # DTOs Pydantic alineados con Frontend/src/types/aspar.ts
│   ├── repositories/      # Consultas a PostgreSQL
│   ├── services/          # Reglas de negocio y auditoría
│   ├── routers/           # Endpoints /api/v1/*
│   └── adapters/          # Supabase Storage (archivos privados)
├── migrations/            # SQL versionado (NNN_nombre.sql)
├── scripts/migrate.py     # Aplicador de migraciones
├── tests/                 # pytest
├── pyproject.toml         # Configuración de Ruff y pytest
├── requirements.txt       # Dependencias de ejecución
└── requirements-dev.txt   # + pytest y ruff
```

## 9. Problemas frecuentes

| Síntoma | Causa y solución |
| :--- | :--- |
| `No module named 'psycopg'` | Código antiguo: `app/core/database.py` debe convertir la URL a `postgresql+psycopg2://` (ya incluido). |
| `could not translate host name "db.<ref>.supabase.co"` | Conexión directa IPv6: usa la cadena del **Session pooler**. |
| `password authentication failed` | La contraseña quedó con corchetes `[ ]` o tiene caracteres especiales sin codificar (`@` → `%40`). |
| `RuntimeError: JWT_SECRET debe ser...` | Genera un secreto propio de 32+ caracteres en `.env`. |
| `ResolutionImpossible ... protobuf` al instalar | Estás usando el `requirements.txt` antiguo en UTF-16; usa el de esta carpeta. |
| `401 La sesión expiró por inactividad` | Pasaron 15 minutos sin peticiones; inicia sesión otra vez. |
