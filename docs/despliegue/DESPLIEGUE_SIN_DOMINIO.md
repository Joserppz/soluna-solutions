# Despliegue sin dominio propio: Cloud Run + Supabase + Vercel

Esta guía publica ASPAR **sin comprar un dominio**, para que el equipo y la asociación lo usen con datos reales. Cuando ASPAR tenga su dominio, se pasa al plan final de la [guía de despliegue](./GUIA_DE_DESPLIEGUE.md) ([ADR-014](../arquitectura/adr/ADR-014-despliegue-y-operacion.md)) sin tocar el código.

| Pieza | Dónde | Dirección |
| :--- | :--- | :--- |
| Sitio y espacio del equipo | Vercel | `https://<tu-proyecto>.vercel.app` |
| API | Google Cloud Run (São Paulo) | `https://aspar-api-….run.app` (nadie la escribe a mano) |
| Base y documentos privados | Supabase (São Paulo) | — |

## Por qué el sitio llama a la API por `/api/v1`

La sesión usa cookies seguras (`SameSite=Lax`, ver [ADR-012](../arquitectura/adr/ADR-012-sesion-en-cookies-y-permisos-en-la-base.md)). El navegador solo las envía si el sitio y la API son **el mismo sitio**. `vercel.app` y `run.app` son sitios distintos, así que el sitio no llama a Cloud Run directamente:

```
Navegador ──► https://<tu-proyecto>.vercel.app/api/v1/...  ──(Vercel reenvía)──►  Cloud Run
```

Para el navegador, todo está en `vercel.app`: las cookies funcionan y no hace falta CORS. Así quedó verificado: el login pasa por el reenvío, la sesión sigue al recargar y la bitácora guarda la IP real de quien ingresa.

## Antes de empezar (una hora, aproximadamente)

Necesitas cuentas en:

- **Google Cloud**, con una tarjeta para activar la facturación. Lo que usa ASPAR entra en la capa gratuita; el paso 4.1 crea una alerta de presupuesto por si acaso.
- **Supabase**, gratis.
- **Brevo**, gratis (300 correos al día): los correos de verificación y de recuperación de contraseña.
- **Cloudflare**, gratis: solo para Turnstile, la verificación «no soy un robot» de los formularios.
- **Vercel**: la que ya usan para el sitio.

> Ninguna clave se pega en el chat, en el repositorio ni en Vercel, salvo las públicas que se indican. Las secretas se escriben una sola vez en Cloud Shell y quedan en Secret Manager.

## 1. Supabase: la base

1. **New project** → nombre `aspar`, región **South America (São Paulo)**. Inventa una contraseña larga para la base y guárdala en un lugar seguro.
2. Inventa otra contraseña larga para el usuario de la API (`aspar_api`); también la usarás en el paso 4.
3. **Connect** (botón arriba) → **Connection string → URI**. Copia dos cadenas y, en cada una, reemplaza `[YOUR-PASSWORD]`:
   - **Session pooler** (puerto **5432**), con la contraseña de la base → será `MIGRATION_DATABASE_URL`.
   - **Transaction pooler** (puerto **6543**) → será `DATABASE_URL`, pero con el usuario de la API: cambia `postgres.<ref>` por `aspar_api.<ref>` y usa la contraseña del punto 2.
     Queda así: `postgresql://aspar_api.<ref>:<contraseña-api>@aws-0-sa-east-1.pooler.supabase.com:6543/postgres`.
4. **Project Settings → API**:
   - **Project URL** → irá en `SUPABASE_URL` (no es secreta);
   - **service_role** (o *secret key*) → `SUPABASE_SERVICE_ROLE_KEY` (secreta).

## 2. Brevo: los correos

1. Crea la cuenta. En **Senders, Domains & Dedicated IPs → Senders → Add a sender**, agrega `asparlapaz@gmail.com` (o el correo que enviará) y confírmalo desde ese buzón.
2. **SMTP & API → API Keys → Generate a new API key** → nombre `aspar-api`. Copia la clave: se muestra una sola vez.

> Sin dominio propio, algunos correos pueden llegar a **spam** la primera vez. Pide a las personas que lo revisen y marquen «No es spam». Con el dominio de ASPAR se agregan SPF y DKIM y esto desaparece.

## 3. Cloudflare Turnstile: «no soy un robot»

1. Cloudflare → **Turnstile → Add widget** → nombre `ASPAR`, **Hostname**: `<tu-proyecto>.vercel.app`, modo **Managed**.
2. Copia las dos claves:
   - **Site Key**: es pública y va en Vercel (paso 5).
   - **Secret Key**: es secreta y va en el paso 4.

## 4. Google Cloud: la API

### 4.1 Proyecto y presupuesto

1. [console.cloud.google.com](https://console.cloud.google.com) → **Crear proyecto** → nombre `aspar`. Anota el **ID del proyecto**.
2. **Facturación** → vincula una cuenta de facturación (la tarjeta).
3. **Facturación → Presupuestos y alertas → Crear presupuesto**: 5 USD, con avisos al 50 %, 90 % y 100 %. Si algún día se acerca, te llega un correo.

### 4.2 Cloud Shell y el repositorio

Abre [shell.cloud.google.com](https://shell.cloud.google.com). Es una terminal en el navegador que ya tiene `gcloud`, `git` y Python.

```bash
gcloud config set project <ID-del-proyecto>
gh auth login                       # GitHub.com → HTTPS → Login with a web browser
gh repo clone Joserppz/soluna-solutions -- -b Sprint2
cd soluna-solutions
cp Backend/deploy/cloud-run.env.example Backend/deploy/cloud-run.env
cloudshell edit Backend/deploy/cloud-run.env    # o: nano Backend/deploy/cloud-run.env
```

Completa en `cloud-run.env`:

- `FRONTEND_URL`: la dirección de Vercel, sin `/` al final;
- `SUPABASE_URL`;
- `EMAIL_FROM` con el remitente verificado en Brevo.

Lo demás puede quedar como está. Este archivo no tiene claves y no se sube a git.

### 4.3 Claves, base, API y primera cuenta

```bash
bash Backend/deploy/cloud_run.sh secretos   # pide cada clave; no se ve al escribirla
bash Backend/deploy/cloud_run.sh migrar     # crea las tablas en Supabase
```

**Usuario de la API.** Ahora, en Supabase → **SQL Editor**, ejecuta lo siguiente con la contraseña de `aspar_api` del paso 1.2. La API queda con permiso para leer y escribir datos, pero no para borrar tablas ni la bitácora.

```sql
create role aspar_api login password '<contraseña-api>'
  nosuperuser nocreatedb nocreaterole bypassrls;
grant usage on schema public to aspar_api;
grant select, insert, update, delete on all tables in schema public to aspar_api;
grant usage, select on all sequences in schema public to aspar_api;
revoke update, delete on public.audit_logs from aspar_api;
grant update (occurrences, last_occurred_at) on public.audit_logs to aspar_api;
revoke all on public.schema_migrations from aspar_api;
alter default privileges in schema public grant select, insert, update, delete on tables to aspar_api;
alter default privileges in schema public grant usage, select on sequences to aspar_api;
```

Si Supabase rechaza `bypassrls`, vuelve a correr `secretos` y, en `DATABASE_URL`, usa el Transaction pooler con el usuario `postgres`. Anótalo como pendiente.

```bash
bash Backend/deploy/cloud_run.sh api        # construye y publica la API (5 a 10 minutos)
bash Backend/deploy/cloud_run.sh admin      # primera cuenta de Administración
```

`api` termina mostrando la dirección de la API, dos comprobaciones («la API responde» y «se conecta con Supabase») y **el contenido exacto de `Frontend/vercel.json`**. Cópialo.

## 5. Vercel: el sitio

1. En tu PC, reemplaza `Frontend/vercel.json` con lo que mostró el paso anterior: la primera regla reenvía `/api/v1` a Cloud Run y la segunda deja que el sitio maneje sus rutas. Haz commit y push.
2. Vercel → el proyecto → **Settings → Environment Variables** (Production):

   | Variable | Valor |
   | :--- | :--- |
   | `VITE_API_BASE_URL` | `/api/v1` |
   | `VITE_TURNSTILE_SITE_KEY` | la Site Key del paso 3 |
   | `VITE_GOOGLE_CLIENT_ID` | vacío por ahora (ver «Opcional») |

3. **Deployments → … → Redeploy**. Las variables `VITE_` se leen al construir: sin un deploy nuevo no cambian.

## 6. Comprobar que todo funciona

- [ ] `https://<tu-proyecto>.vercel.app/api/v1/health` responde `{"status":"ok"…}`.
- [ ] Entras con la cuenta de Administración y, al recargar, sigues dentro.
- [ ] **Crear cuenta** con otro correo: llega «Confirma tu correo en ASPAR» (revisa spam) y, al confirmar, la cuenta aparece pendiente en **Equipo y permisos**.
- [ ] **Recuperar contraseña** envía el correo con el enlace a `vercel.app`.
- [ ] El formulario de contacto del sitio pasa el «no soy un robot» y la solicitud aparece en **Solicitudes**.
- [ ] **Registro de actividad**: tu ingreso aparece con **tu** IP. Si aparece otra que se repite para todos, cambia `PROXY_TRUSTED_HOPS` en `cloud-run.env` y vuelve a correr `api`.
- [ ] En una ficha de prueba, subes un documento pequeño y lo abres.

## Opcional

- **Galería (Cloudinary):** crea la cuenta y copia *Cloud name* y *API key* en `cloud-run.env`. Corre `secretos` (el *API secret* va ahí) y después `api`.
- **«Continuar con Google»:** Google Cloud → **APIs y servicios → Credenciales → ID de cliente de OAuth → Aplicación web**. En *Orígenes de JavaScript autorizados* pon `https://<tu-proyecto>.vercel.app`. Lleva el ID a `GOOGLE_CLIENT_ID` en `cloud-run.env` (y corre `api`) y a `VITE_GOOGLE_CLIENT_ID` en Vercel (y haz redeploy).
- **Respaldos diarios cifrados:** sección 8 de la [guía de despliegue](./GUIA_DE_DESPLIEGUE.md#8-respaldos-y-restauración).

## Publicar una versión nueva

Cuando haya cambios en Sprint2:

```bash
cd ~/soluna-solutions && git pull
bash Backend/deploy/cloud_run.sh migrar     # solo aplica las migraciones nuevas
bash Backend/deploy/cloud_run.sh api
```

El sitio se actualiza solo en Vercel con cada push.

Para cambiar una clave, corre `secretos` y presiona Enter en las demás; después corre `api`.

## Lo que queda para cuando haya dominio

| En esta etapa | Con el dominio de ASPAR |
| :--- | :--- |
| Los correos salen desde un Gmail y pueden caer en spam | SPF, DKIM y DMARC del dominio |
| Todo pasa por el reenvío de Vercel, que tiene su propio límite de tamaño: si falla un documento grande, súbelo más liviano | El sitio y la API en `aspar.org` y `api.aspar.org`, sin reenvío |
| Quien conozca la dirección `run.app` puede llamar a la API sin pasar por Vercel. La sesión, el CSRF y los permisos siguen protegiendo los datos; lo único que se debilita es el límite de intentos por IP | Cloud Run solo detrás del dominio |
| Supabase gratis pausa la base tras 7 días sin uso; se reactiva desde su panel | Plan de pago o uso semanal constante |
| La primera visita después de un rato tarda unos segundos (la API se apaga sola cuando nadie la usa) | `--min-instances=1` si molesta (tiene costo) |
