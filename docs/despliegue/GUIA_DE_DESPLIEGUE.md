# Guía de despliegue y operación — ASPAR

Pasos para publicar el sistema según [ADR-014](../arquitectura/adr/ADR-014-despliegue-y-operacion.md).

- Cada paso se hace **una vez por entorno**: primero `staging` y, cuando todo funciona, `prod`.
- Los nombres usan `<entorno>` (`staging` o `prod`) y `<proyecto>` (el id del proyecto de Google Cloud).
- Los comandos de `gcloud` se ejecutan en [Cloud Shell](https://shell.cloud.google.com), que ya trae `gcloud` y `psql`.

| Entorno | Frontend | API | Base y archivos |
| :--- | :--- | :--- | :--- |
| `staging` | `https://staging.aspar.com` | `https://api.staging.aspar.com` | Supabase `aspar-staging` |
| `prod` | `https://aspar.com` | `https://api.aspar.com` | Supabase `aspar-prod` |

> Staging nunca tiene datos reales de afiliados. Para probar con cuentas usa `python -m scripts.create_admin`; `seed_demo` se niega a correr con `ENV=prod`.

## 1. Supabase: proyecto, conexiones y rol de la API

1. Crea el proyecto `aspar-<entorno>` en la región **South America (São Paulo)**. Guarda la contraseña de la base en un gestor de contraseñas.
2. En **Connect**, copia dos cadenas:
   - **Session pooler** (puerto 5432) → será `MIGRATION_DATABASE_URL` (usuario `postgres`, dueño del esquema).
   - **Transaction pooler** (puerto 6543) → servirá para armar `DATABASE_URL`, con el usuario `aspar_api` del paso 4.
3. Aplica las migraciones con el job del paso 3, o una sola vez desde tu PC con `MIGRATION_DATABASE_URL`: `python -m scripts.migrate`.
4. **Rol de la API (solo datos, sin cambios de esquema).** En **SQL Editor** ejecuta lo siguiente, con una contraseña larga y aleatoria:

   ```sql
   create role aspar_api login password '<contraseña-aleatoria>'
     nosuperuser nocreatedb nocreaterole bypassrls;
   grant usage on schema public to aspar_api;
   grant select, insert, update, delete on all tables in schema public to aspar_api;
   grant usage, select on all sequences in schema public to aspar_api;
   -- La bitácora solo se agrega y se lee (las repeticiones agrupadas suman occurrences)
   revoke update, delete on public.audit_logs from aspar_api;
   grant update (occurrences, last_occurred_at) on public.audit_logs to aspar_api;
   revoke all on public.schema_migrations from aspar_api;
   -- Tablas de migraciones futuras
   alter default privileges in schema public grant select, insert, update, delete on tables to aspar_api;
   alter default privileges in schema public grant usage, select on sequences to aspar_api;
   ```

   - Las tablas tienen RLS activo y sin políticas ([ADR-007](../arquitectura/adr/ADR-007-supabase-solo-desde-el-backend.md)). Por eso `aspar_api` necesita `bypassrls`: sin él vería 0 filas.
   - Si Supabase rechaza `bypassrls`, deja la API con el usuario `postgres` por ahora y anótalo como pendiente. **No** crees políticas abiertas para `anon` ni `authenticated`.
   - `DATABASE_URL` queda así: `postgresql://aspar_api.<project-ref>:<contraseña>@aws-0-sa-east-1.pooler.supabase.com:6543/postgres`.
   - Verificado en PostgreSQL 16 (Docker): con este rol la API inicia sesión, lista, crea cuentas y agrupa intentos fallidos. `create table`, `drop table` y `delete from audit_logs` responden *permission denied*.
5. **Storage:** la migración 001 crea el bucket privado `documentos-pacientes`. Copia la `service_role` de **Project Settings → API Keys**: será `SUPABASE_SERVICE_ROLE_KEY`, solo para el Backend.
6. **Backups:** revisa en **Database → Backups** qué incluye el plan. Los respaldos propios del paso 8 se hacen igual.

## 2. Google Cloud: proyecto, imagen y secretos

```bash
gcloud config set project <proyecto>
gcloud services enable run.googleapis.com secretmanager.googleapis.com \
  artifactregistry.googleapis.com cloudscheduler.googleapis.com

# Repositorio de imágenes y build (desde la raíz del repositorio)
gcloud artifacts repositories create aspar --repository-format=docker --location=southamerica-east1
gcloud builds submit Backend --region=southamerica-east1 \
  --tag southamerica-east1-docker.pkg.dev/<proyecto>/aspar/api:<versión>
```

> `gcloud builds submit` construye la última etapa del Dockerfile, que es `runtime`. Para fijarla explícitamente, construye con `docker build --target runtime` y sube con `docker push`.

**Cuentas de servicio:** una para la API y otra para el job de migraciones. Ninguna lleva roles de proyecto amplios.

```bash
gcloud iam service-accounts create aspar-api-<entorno>
gcloud iam service-accounts create aspar-migrate-<entorno>
```

**Secretos.** Créalos con `--data-file=-` para que el valor no quede en el historial de la terminal:

```bash
crear() {  # crear <nombre> <cuenta-que-lo-lee>
  gcloud secrets create "$1" --replication-policy=automatic --data-file=-
  gcloud secrets add-iam-policy-binding "$1" \
    --member="serviceAccount:$2@<proyecto>.iam.gserviceaccount.com" \
    --role=roles/secretmanager.secretAccessor
}
python3 -c "import secrets; print(secrets.token_urlsafe(48), end='')" | crear aspar-<entorno>-jwt-secret aspar-api-<entorno>
printf '%s' '<DATABASE_URL con aspar_api>'      | crear aspar-<entorno>-database-url aspar-api-<entorno>
printf '%s' '<service_role de Supabase>'        | crear aspar-<entorno>-supabase-service-role aspar-api-<entorno>
printf '%s' '<API key de Resend>'               | crear aspar-<entorno>-resend-api-key aspar-api-<entorno>
printf '%s' '<secret key de Turnstile>'         | crear aspar-<entorno>-turnstile-secret aspar-api-<entorno>
printf '%s' '<MIGRATION_DATABASE_URL>'          | crear aspar-<entorno>-migration-database-url aspar-migrate-<entorno>
```

**Rotar un secreto:** `printf '%s' '<nuevo>' | gcloud secrets versions add <nombre> --data-file=-`. Después despliega una revisión nueva (paso 4) para que la API lo lea. Al rotar `JWT_SECRET` se cierran todas las sesiones abiertas.

## 3. Migraciones: Cloud Run Job

`scripts.migrate` carga la configuración de la API: necesita `DATABASE_URL` y un `JWT_SECRET` de 32+ caracteres, aunque no firma tokens. Por eso el job usa la URL de migraciones en los dos lugares y un `JWT_SECRET` aleatorio propio.

```bash
gcloud run jobs create aspar-migrate-<entorno> --region=southamerica-east1 \
  --image=southamerica-east1-docker.pkg.dev/<proyecto>/aspar/api:<versión> \
  --service-account=aspar-migrate-<entorno>@<proyecto>.iam.gserviceaccount.com \
  --set-secrets=MIGRATION_DATABASE_URL=aspar-<entorno>-migration-database-url:latest,DATABASE_URL=aspar-<entorno>-migration-database-url:latest \
  --set-env-vars=JWT_SECRET=$(python3 -c "import secrets; print(secrets.token_urlsafe(48))") \
  --command=python --args=-m,scripts.migrate --max-retries=0

# En cada versión: actualizar la imagen del job, migrar y recién después desplegar la API
gcloud run jobs update aspar-migrate-<entorno> --region=southamerica-east1 \
  --image=southamerica-east1-docker.pkg.dev/<proyecto>/aspar/api:<versión>
gcloud run jobs execute aspar-migrate-<entorno> --region=southamerica-east1 --wait
```

Si el job termina con *«fue modificada después de aplicarse»*, alguien editó una migración ya aplicada. No se corrige en la base: se revierte el archivo y el cambio va en la siguiente migración `NNN_...sql`.

## 4. API en Cloud Run

Variables no secretas en `env.<entorno>.yaml`. **Este archivo no se sube al repositorio:** guárdalo junto a las notas del despliegue.

```yaml
ENV: prod                     # también en staging: aplica las validaciones de producción
LOG_LEVEL: INFO
DB_POOL: 'null'               # Transaction Pooler: Supabase ya reutiliza las conexiones
PROXY_TRUSTED_HOPS: '1'       # Cloud Run agrega la IP real del cliente
COOKIE_SECURE: 'true'
COOKIE_DOMAIN: ''             # cookie solo de esta API (ADR-012)
CORS_ORIGINS: https://staging.aspar.com      # prod: https://aspar.com,https://www.aspar.com
FRONTEND_URL: https://staging.aspar.com      # prod: https://aspar.com
EMAIL_PROVIDER: resend
EMAIL_FROM: ASPAR <no-responder@aspar.com>
GOOGLE_CLIENT_ID: <id>.apps.googleusercontent.com
SUPABASE_URL: https://<project-ref>.supabase.co
```

```bash
gcloud run deploy aspar-api-<entorno> --region=southamerica-east1 \
  --image=southamerica-east1-docker.pkg.dev/<proyecto>/aspar/api:<versión> \
  --service-account=aspar-api-<entorno>@<proyecto>.iam.gserviceaccount.com \
  --env-vars-file=env.<entorno>.yaml \
  --set-secrets=JWT_SECRET=aspar-<entorno>-jwt-secret:latest,DATABASE_URL=aspar-<entorno>-database-url:latest,SUPABASE_SERVICE_ROLE_KEY=aspar-<entorno>-supabase-service-role:latest,RESEND_API_KEY=aspar-<entorno>-resend-api-key:latest,TURNSTILE_SECRET_KEY=aspar-<entorno>-turnstile-secret:latest \
  --allow-unauthenticated --min-instances=0 --max-instances=3
```

- **La API no arranca** si con `ENV=prod` encuentra el correo en `console`, la clave de prueba de Turnstile, `COOKIE_SECURE=false`, los límites apagados o un origen CORS sin `https`. El log de la revisión dice cuál falta.
- **Dominio:** en Cloud Run → **Integraciones / Asignaciones de dominio**, asigna `api.<dominio>` al servicio y crea en el DNS el registro que indica Google.
- **IP real del cliente:** inicia sesión y revisa la bitácora (`GET /audit`). La IP debe ser la tuya. Si aparece una IP de Google, ajusta `PROXY_TRUSTED_HOPS`: con un balanceador externo delante suele ser `2`.
- **Primera cuenta:** ejecuta `python -m scripts.create_admin` desde tu PC, con `DATABASE_URL` apuntando a la base del entorno (Session pooler). El script pide la contraseña dos veces sin mostrarla, por eso no se ejecuta como job.

## 5. Google: «Continuar con Google»

1. Google Cloud → **APIs y servicios → Pantalla de consentimiento de OAuth**: tipo *Externo*, nombre «ASPAR», correo de soporte y dominio `aspar.com`.
2. **Credenciales → Crear credenciales → ID de cliente de OAuth → Aplicación web.**
   - **Orígenes de JavaScript autorizados:** `https://aspar.com`, `https://staging.aspar.com` y, para desarrollo, `http://localhost:5173`.
   - El botón de Google Identity Services entrega un *ID token*, no una redirección, así que no hacen falta URI de redirección.
3. El **ID de cliente** es público:
   - va en `GOOGLE_CLIENT_ID` (API) y en `VITE_GOOGLE_CLIENT_ID` (Frontend);
   - sin él, `POST /auth/google` responde 503.

La API exige `email_verified=true` y nunca vincula Google a una cuenta con contraseña cuyo correo no está confirmado ([ADR-012](../arquitectura/adr/ADR-012-sesion-en-cookies-y-permisos-en-la-base.md)).

## 6. Cloudflare Turnstile (CAPTCHA)

1. Cloudflare → **Turnstile → Add widget**: nombre `ASPAR <entorno>`, modo *Managed*, dominios del entorno (`staging.aspar.com` o `aspar.com`).
2. La **Site Key** es pública y va en `VITE_TURNSTILE_SITE_KEY` (Frontend). La **Secret Key** va al secreto `aspar-<entorno>-turnstile-secret`.
3. En desarrollo se usan las claves de prueba de Cloudflare, que siempre aprueban. La API se niega a arrancar en producción con la de prueba.

## 7. Resend (correos de verificación y recuperación)

1. Crea la cuenta y, en **Domains → Add domain**, agrega `aspar.com` (región São Paulo si está disponible).
2. Copia en el DNS los registros que indica Resend: **SPF** (TXT), **DKIM** (TXT) y el **MX** de rebotes del subdominio. Agrega también **DMARC**: `_dmarc.aspar.com TXT "v=DMARC1; p=quarantine; rua=mailto:<correo-de-la-asociación>"`.
3. Espera el estado *Verified*. Luego, en **API Keys → Create**, crea una clave con permiso **Sending access**, limitada a `aspar.com`, y guárdala en `aspar-<entorno>-resend-api-key`.
4. Prueba: registra una cuenta en staging y revisa que el correo llegue y no termine en spam.
5. **Alternativa:** Brevo. Usa `EMAIL_PROVIDER=brevo` y `BREVO_API_KEY`, y verifica el dominio de la misma forma.

## 8. Respaldos y restauración

### Base de datos: `pg_dump` diario

- Se hace con un Cloud Run Job (imagen `postgres:16`) programado con Cloud Scheduler a las 03:00 (hora de Bolivia).
- El job usa `MIGRATION_DATABASE_URL` en modo solo lectura y sube el archivo a un bucket privado.

```bash
gcloud storage buckets create gs://aspar-<entorno>-respaldos --location=southamerica-east1 \
  --uniform-bucket-level-access --public-access-prevention
# Borra los respaldos con más de 30 días
printf '{"rule":[{"action":{"type":"Delete"},"condition":{"age":30}}]}' > ciclo.json
gcloud storage buckets update gs://aspar-<entorno>-respaldos --lifecycle-file=ciclo.json
```

Comando del job (formato *custom* de `pg_dump`, comprimido):

```bash
pg_dump "$MIGRATION_DATABASE_URL" --format=custom --no-owner --no-privileges \
  --file=/tmp/aspar-$(date +%F).dump
```

Luego se sube a `gs://aspar-<entorno>-respaldos/base/` con `gcloud storage cp` (imagen `google/cloud-sdk` con `postgresql-client`).

### Documentos privados

Los respaldos de la base **no** incluyen los archivos de Supabase Storage. El mismo job copia el bucket `documentos-pacientes` a `gs://aspar-<entorno>-respaldos/documentos/` con la API S3 de Supabase Storage (**Project Settings → Storage → S3 access keys**) y `rclone sync`.

### Restaurar

```bash
pg_restore --clean --if-exists --no-owner --dbname "$MIGRATION_DATABASE_URL_DESTINO" aspar-AAAA-MM-DD.dump
```

- **Cada mes:** restaura el último respaldo de producción en **staging**, borra o anonimiza los datos de afiliados al terminar, y registra la prueba (fecha, duración y resultado).
- Un respaldo que nunca se restauró no está comprobado.

> Los respaldos tienen datos clínicos (RNF-06). Solo la cuenta de servicio del job y la dirección del proyecto acceden al bucket.

## 9. Frontend

- Build con las variables del entorno y publicación de `Frontend/dist/` en el hosting estático elegido para `aspar.com` o `staging.aspar.com`.
  - `VITE_API_BASE_URL=https://api.<dominio>/api/v1`
  - `VITE_DEMO_MODE=false`
  - `VITE_GOOGLE_CLIENT_ID` y `VITE_TURNSTILE_SITE_KEY`
- El hosting debe responder `index.html` en cualquier ruta, porque es una SPA con `vue-router`.

## 10. Lista de verificación por despliegue

- [ ] CI en verde en el commit a desplegar (pruebas, cobertura, `pip-audit`, `npm audit` e imagen Docker).
- [ ] Imagen construida y subida con la versión (`:<versión>`, nunca solo `:latest`).
- [ ] Job de migraciones ejecutado sin errores (`--status` muestra todas como aplicadas).
- [ ] Nueva revisión de la API desplegada; `GET /api/v1/health/db` responde 200.
- [ ] Inicio de sesión, `GET /auth/me` y un listado probados en el frontend del entorno.
- [ ] `/docs` responde 404 (en producción no se publica la documentación interactiva).
- [ ] Último respaldo diario presente en el bucket.
