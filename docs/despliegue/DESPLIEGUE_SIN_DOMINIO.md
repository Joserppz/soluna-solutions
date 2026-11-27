# Despliegue sin dominio propio: Cloud Run + Supabase + Cloudflare Pages

Esta guía publica ASPAR **sin comprar un dominio**, para que el equipo y la asociación lo usen con datos reales. Cuando ASPAR tenga su dominio, se pasa al plan final de la [guía de despliegue](./GUIA_DE_DESPLIEGUE.md) ([ADR-014](../arquitectura/adr/ADR-014-despliegue-y-operacion.md)) sin tocar el código.

| Pieza | Dónde | Dirección |
| :--- | :--- | :--- |
| Sitio y espacio del equipo | Cloudflare Pages | `https://<tu-proyecto>.pages.dev` |
| API | Google Cloud Run (southamerica-east1, São Paulo) | `https://aspar-api-….run.app` (nadie la escribe a mano) |
| Base y documentos privados | Supabase (sa-east-1, São Paulo) | — |

Todas las cuentas técnicas son de quien mantiene el sistema. El único dato de ASPAR es su correo, que se usa como remitente.

## Por qué el sitio llama a la API por `/api/v1`

La sesión usa cookies seguras (`SameSite=Lax`, ver [ADR-012](../arquitectura/adr/ADR-012-sesion-en-cookies-y-permisos-en-la-base.md)), y el navegador solo las envía si el sitio y la API son **el mismo sitio**. `pages.dev` y `run.app` son sitios distintos. Por eso el sitio no llama a Cloud Run directamente:

```
Navegador ──► https://<tu-proyecto>.pages.dev/api/v1/...  ──(Pages Function)──►  Cloud Run
```

La función está en `Frontend/functions/api/v1/[[path]].ts` y lee la dirección de Cloud Run de la variable `API_ORIGIN`. Para el navegador todo queda en `pages.dev`: las cookies funcionan y no hace falta CORS. Se verificó con `wrangler pages dev`, el mismo motor de Cloudflare: el login pasa por la función, la sesión sigue al recargar y la bitácora guarda la IP real de quien ingresa.

## Antes de empezar (una hora, aproximadamente)

Necesitas cuentas en:

- **Google Cloud**, con una tarjeta para activar la facturación. Lo que usa ASPAR entra en la capa gratuita; el paso 4.1 crea una alerta de presupuesto por si acaso.
- **Supabase**, gratis.
- **Brevo**, gratis (300 correos al día): los correos de verificación y de recuperación de contraseña.
- **Cloudflare**, gratis: el sitio (Pages) y la verificación «no soy un robot» de los formularios (Turnstile).

> Ninguna clave se pega en el chat ni en el repositorio. Las secretas se escriben una sola vez en Cloud Shell y quedan en Secret Manager. En Cloudflare solo van claves públicas y la dirección de la API.

## 1. Supabase: la base

1. **New project** → nombre `aspar`, región **South America (São Paulo)**, junto a la API en Cloud Run (`southamerica-east1`).
   - En *Security*: **desmarca** «Enable Data API» y «Automatically expose new tables», y **marca** «Enable automatic RLS». ASPAR solo usa la base desde la API ([ADR-007](../arquitectura/adr/ADR-007-supabase-solo-desde-el-backend.md)).
   - El aviso «Client libraries need Data API» no aplica a ASPAR: ignóralo.
2. Guarda la contraseña de la base e inventa otra para el usuario de la API (`aspar_api`). Usa **solo letras y números**, de 20 caracteres o más: los símbolos rompen las direcciones de conexión.
3. **Connect → Direct → Type: URI**. Copia la dirección del cuadro *Shared pooler* dos veces:
   - con **Session pooler** marcado (puerto **5432**), reemplazando `[YOUR-PASSWORD]` por la contraseña de la base → `MIGRATION_DATABASE_URL`;
   - con **Transaction pooler** marcado (puerto **6543**), cambiando `postgres.<ref>` por `aspar_api.<ref>` y usando la contraseña de `aspar_api` → `DATABASE_URL`.
   - No actives el «IPv4 add-on»: el *Shared pooler* ya funciona con IPv4.
4. Datos del proyecto:
   - **Project URL** = `https://<ref>.supabase.co`. El `<ref>` es el código que va después de `postgres.` en las direcciones; también aparece en Project Settings → General. Irá en `SUPABASE_URL` y no es secreto.
   - **Project Settings → API Keys → View legacy API keys → `service_role`** (empieza con `eyJ…`) → `SUPABASE_SERVICE_ROLE_KEY`, que es secreta. *Pendiente para antes de 2027: pasar a la nueva `sb_secret_…`, cuando Supabase retire las claves legacy.*

## 2. Brevo: los correos

1. Crea la cuenta. Si pide sitio web, marca «No tengo sitio web» o pon la dirección de Pages del paso 3.
2. **Senders, Domains & Dedicated IPs → Senders → Add sender**: nombre `ASPAR`, correo `asparlapaz@gmail.com`. Brevo envía un código o un enlace a ese buzón, y alguien de ASPAR lo confirma. Debe quedar en **Verified**.
3. **SMTP & API → API Keys → Generate a new API key** → nombre `aspar-api`, acceso **Restringido**, con solo el envío de correos transaccionales. Copia la clave en ese momento, porque se muestra una sola vez. Debe empezar con **`xkeysib-`**; las de la pestaña SMTP (`xsmtpsib-`) no sirven.
4. **Security → Authorized IPs:** el bloqueo para **claves API** debe quedar **desactivado**. Cloud Run cambia de IP y Brevo rechazaría los envíos.

> **La clave caduca tras 90 días sin uso.** Si pasan 3 meses sin registros ni recuperaciones de contraseña y dejan de llegar los correos, genera una nueva, corre `secretos` (solo cambia la de Brevo) y luego `api`.

> Sin dominio propio, algunos correos pueden llegar a **spam** la primera vez. Pide a las personas que lo revisen y marquen «No es spam». Con el dominio de ASPAR se agregan SPF y DKIM y esto desaparece.

## 3. Cloudflare: el sitio y Turnstile

### 3.1 Proyecto de Pages

1. Cloudflare → **Workers & Pages → Create → Pages → Connect to Git**. Autoriza GitHub y elige `soluna-solutions`.
2. **Project name**: `aspar`, o el que esté libre. La dirección queda `https://<project-name>.pages.dev`; anótala, porque es tu `FRONTEND_URL`.
3. Configuración:

   | Campo | Valor |
   | :--- | :--- |
   | Production branch | `main` |
   | Framework preset | `None` |
   | Build command | `npm ci && npm run build` |
   | Build output directory | `dist` |
   | Root directory | `Frontend` |

4. **Environment variables** (Production):

   | Variable | Valor |
   | :--- | :--- |
   | `NODE_VERSION` | `22` |
   | `VITE_API_BASE_URL` | `/api/v1` |
   | `VITE_SITE_URL` | `https://<project-name>.pages.dev` |
   | `VITE_TURNSTILE_SITE_KEY` | la Site Key del 3.2 (agrégala cuando la tengas) |
   | `VITE_GOOGLE_CLIENT_ID` | vacío por ahora (ver «Opcional») |
   | `API_ORIGIN` | la dirección de Cloud Run (paso 5) |

5. **Save and Deploy**. El sitio ya se ve. El espacio del equipo responde «Falta configurar API_ORIGIN» hasta el paso 5, y eso es lo esperado.

### 3.2 Turnstile

1. Cloudflare → **Turnstile → Add widget** → nombre `ASPAR`, **Hostname**: `<project-name>.pages.dev`, modo **Managed**.
2. Copia las dos claves:
   - **Site Key**: pública, va en la variable `VITE_TURNSTILE_SITE_KEY` del 3.1.
   - **Secret Key**: secreta, va en el paso 4.

## 4. Google Cloud: la API

### 4.1 Proyecto y presupuesto

1. [console.cloud.google.com](https://console.cloud.google.com) → **Crear proyecto** → nombre `aspar`. Anota el **ID del proyecto**.
2. **Facturación** → vincula una cuenta de facturación (la tarjeta).
3. **Facturación → Presupuestos y alertas → Crear presupuesto**: 5 USD, con avisos al 50 %, 90 % y 100 %.

### 4.2 Cloud Shell y el repositorio

Abre [shell.cloud.google.com](https://shell.cloud.google.com). Es una terminal en el navegador que ya trae `gcloud`, `git` y Python.

```bash
gcloud config set project <ID-del-proyecto>
gh auth login                       # GitHub.com → HTTPS → Login with a web browser
gh repo clone Joserppz/soluna-solutions -- -b main
cd soluna-solutions
cp Backend/deploy/cloud-run.env.example Backend/deploy/cloud-run.env
cloudshell edit Backend/deploy/cloud-run.env    # o: nano Backend/deploy/cloud-run.env
```

Completa en `cloud-run.env`:

- `FRONTEND_URL`: la dirección de Pages, sin `/` al final;
- `SUPABASE_URL`;
- `EMAIL_FROM` con el remitente verificado en Brevo.

Lo demás puede quedar como está. Este archivo no tiene claves y no se sube a git.

### 4.3 Claves, base, API y primera cuenta

```bash
bash Backend/deploy/cloud_run.sh secretos   # pide cada clave; no se ve al escribirla
bash Backend/deploy/cloud_run.sh migrar     # crea las tablas en Supabase
```

**Usuario de la API.** Ahora, en Supabase → **SQL Editor**, ejecuta lo siguiente con la contraseña de `aspar_api`. La API queda con permiso para leer y escribir datos, pero no para borrar tablas ni la bitácora.

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

`api` termina mostrando la dirección de la API y dos comprobaciones: «la API responde» y «se conecta con Supabase».

## 5. Conectar el sitio con la API

1. Cloudflare → tu proyecto de Pages → **Settings → Variables and Secrets** (Production) → `API_ORIGIN` = la dirección que mostró `api` (`https://aspar-api-….run.app`, sin `/` al final).
2. **Deployments → … → Retry deployment**. Las variables se leen al construir: sin un deploy nuevo no cambian.

## 6. Comprobar que todo funciona

- [ ] `https://<project-name>.pages.dev/api/v1/health` responde `{"status":"ok"…}`.
- [ ] Entras con la cuenta de Administración y, al recargar, sigues dentro.
- [ ] **Crear cuenta** con otro correo: llega «Confirma tu correo en ASPAR» (revisa spam) y, al confirmar, la cuenta aparece pendiente en **Equipo y permisos**.
- [ ] **Recuperar contraseña** envía el correo con el enlace a `pages.dev`.
- [ ] El formulario de contacto del sitio pasa el «no soy un robot» y la solicitud aparece en **Solicitudes**.
- [ ] **Registro de actividad**: tu ingreso aparece con **tu** IP. Si todas las personas aparecen con la misma IP, que no es la de nadie, cambia `PROXY_TRUSTED_HOPS` en `cloud-run.env` (prueba con `3`) y vuelve a correr `api`.
- [ ] En una ficha de prueba, subes un documento pequeño y lo abres.

## 7. Monitoreo y base siempre activa

En GitHub → **Settings → Secrets and variables → Actions → Variables → New repository variable**: `API_URL` = la dirección de la API (`https://aspar-api-….run.app`, sin `/` al final).

Desde ese momento, el workflow **«Disponibilidad de la API y la base»** ([`.github/workflows/disponibilidad.yml`](../../.github/workflows/disponibilidad.yml)) consulta `/api/v1/health/db` cada 6 horas:

- Si la API o la base no responden, queda en rojo y GitHub avisa por correo (RNF-04).
- Cada consulta usa la base, así Supabase gratis no la pausa por inactividad aunque ASPAR la use solo los sábados.

GitHub corre estas tareas programadas solo desde `main`. Si el repositorio pasa 60 días sin cambios, GitHub las desactiva: se reactivan en **Actions → el workflow → Enable workflow**.

## Opcional

- **Galería (Cloudinary):** crea la cuenta y copia *Cloud name* y *API key* en `cloud-run.env`. Corre `secretos` (el *API secret* va ahí) y después `api`.
- **«Continuar con Google»:** Google Cloud → **APIs y servicios → Credenciales → ID de cliente de OAuth → Aplicación web**. En *Orígenes de JavaScript autorizados* pon `https://<project-name>.pages.dev`. Lleva el ID a `GOOGLE_CLIENT_ID` en `cloud-run.env` (y corre `api`) y a `VITE_GOOGLE_CLIENT_ID` en Pages (y haz *Retry deployment*).
- **Respaldos diarios cifrados:** sección 8 de la [guía de despliegue](./GUIA_DE_DESPLIEGUE.md#8-respaldos-y-restauración).

## Publicar una versión nueva

El trabajo diario va en la rama del sprint (por ejemplo `Sprint3`). Al pasarla a `main`, el sitio se actualiza solo en Cloudflare Pages. Para la API:

```bash
cd ~/soluna-solutions && git pull
bash Backend/deploy/cloud_run.sh migrar     # solo aplica las migraciones nuevas
bash Backend/deploy/cloud_run.sh api
```

Para cambiar una clave, corre `secretos` y presiona Enter en las demás; después corre `api`.

## Lo que queda para cuando haya dominio

| En esta etapa | Con el dominio de ASPAR (comprado en Cloudflare, se conecta en minutos) |
| :--- | :--- |
| Los correos salen desde un Gmail y pueden caer en spam | SPF, DKIM y DMARC del dominio |
| Quien conozca la dirección `run.app` puede llamar a la API sin pasar por Pages. La sesión, el CSRF y los permisos siguen protegiendo los datos; lo único que se debilita es el límite de intentos por IP | La API en `api.<dominio>` |
| Supabase gratis pausa la base tras 7 días sin uso; el monitoreo de la sección 7 la mantiene activa | Plan de pago si el uso crece |
| La primera visita después de un rato tarda unos segundos, porque la API se apaga sola cuando nadie la usa | `--min-instances=1` si molesta (tiene costo) |
