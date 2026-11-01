# Diagramas C4 y Modelo Entidad-Relación — estado del Sprint 2 (SCRUM-64 / SCRUM-106)

Los diagramas originales (`modelos/c4/C1.jpeg`, `C2.jpeg`, `C3.jpeg` y [`DOCUMENTO_3.pdf`](./DOCUMENTO_3.pdf)) describen la arquitectura **propuesta**. Este documento es la versión vigente: muestra lo que está implementado en la rama `Sprint2` al cerrar el Backend.

- Las decisiones que explican cada pieza están en el [registro de ADR](./adr/README.md).
- El despliegue (Cloud Run, Cloudflare Pages, Supabase, Secret Manager) sigue [ADR-014](./adr/ADR-014-despliegue-y-operacion.md) y la [guía de despliegue](../despliegue/GUIA_DE_DESPLIEGUE.md). Hasta el primer despliegue el sistema corre en Docker local con la misma imagen.
- El contrato entre Frontend y Backend está en [`MODELO_DATOS_Y_CONTRATOS.md`](./MODELO_DATOS_Y_CONTRATOS.md) y en [`openapi.json`](../api/openapi.json).

## 1. Cambios respecto de los diagramas originales

| Nivel | Diagrama original | Implementación actual | ADR |
| :--- | :--- | :--- | :--- |
| C1 | Personal, público y sistema web; almacenamiento y pasarela de pagos | Sin pasarela: las donaciones por QR bancario se **confirman a mano contra el extracto**. Se suman Google (inicio de sesión), Cloudflare Turnstile (CAPTCHA) y Resend (correos) | ADR-012, ADR-014 |
| C2 | SPA Vue 3, API FastAPI, PostgreSQL y Cloud Storage | SPA en **Cloudflare Pages**, API en **Cloud Run**, migraciones en un **Cloud Run Job**, secretos en **Secret Manager**. PostgreSQL y documentos privados en **Supabase**; galería en **Cloudinary**. Respaldos cifrados con **GitHub Actions** | ADR-002, ADR-007, ADR-010, ADR-014 |
| C3 | JWT Auth Middleware, Routers, Services, Repositories, Adapters | **16 módulos de dominio** con la misma estructura interna, un **núcleo** común y **5 adaptadores**. La sesión va en **cookies HttpOnly con CSRF** y los permisos están en la base | ADR-011, ADR-012 |
| Datos | E-R a cargo de la arquitecta | **25 tablas** en 3 migraciones SQL versionadas (`001` a `003`) | ADR-002 |

## 2. Nivel C1 — Contexto

```mermaid
flowchart LR
    publico["👥 Público general<br/>(afiliados, familias, donantes, voluntarios)"]
    personal["👩‍⚕️ Personal ASPAR<br/>(Administración, Coordinación, Profesional,<br/>Recepción, Voluntariado y roles nuevos)"]
    sistema["🖥️ Sistema Web ASPAR<br/>Sitio público y panel de gestión"]

    google["🔑 Google Identity<br/>(Continuar con Google)"]
    turnstile["🛡️ Cloudflare Turnstile<br/>(CAPTCHA de formularios)"]
    resend["✉️ Resend<br/>(verificación y recuperación)"]
    supabase["🗄️ Supabase<br/>(PostgreSQL y documentos privados)"]
    cloudinary["🖼️ Cloudinary<br/>(galería · RNF-10)"]
    banco["🏦 Cuenta bancaria de ASPAR<br/>(QR y extracto)"]
    redes["📱 Redes sociales<br/>(Facebook, Instagram, TikTok)"]

    publico -- "ve actividades y galería,<br/>avisa donaciones, envía solicitudes" --> sistema
    personal -- "gestiona afiliados, actividades, asistencia,<br/>inventario, donaciones, contenido y equipo" --> sistema
    publico -. "paga con el QR" .-> banco
    sistema -- "verifica el ID token" --> google
    sistema -- "valida el CAPTCHA" --> turnstile
    sistema -- "envía correos" --> resend
    sistema -- "guarda datos y archivos privados" --> supabase
    sistema -- "firma subidas y borra archivos" --> cloudinary
    personal -. "concilia con el extracto" .-> banco
    sistema -- "enlaces oficiales" --> redes
```

## 3. Nivel C2 — Contenedores

```mermaid
flowchart TB
    navegador["Navegador del usuario"]

    subgraph cloudflare["Cloudflare"]
        spa["SPA Frontend · Cloudflare Pages<br/>Vue 3 + TypeScript + Vite<br/><i>Frontend/dist</i> · aspar.com"]
        turnstile[["Turnstile<br/>siteverify"]]
    end

    subgraph gcp["Google Cloud · southamerica-east1"]
        api["API Backend · Cloud Run<br/>Python 3.12 + FastAPI<br/><i>Backend/app</i> · api.aspar.com"]
        job["Cloud Run Job aspar-migrate<br/><i>scripts.migrate</i>"]
        secretos[["Secret Manager<br/>aspar-&lt;entorno&gt;-*"]]
    end

    subgraph supabase["Supabase · sa-east-1"]
        db[("PostgreSQL 17<br/>25 tablas · RLS sin políticas<br/>migraciones 001 a 003")]
        bucket[["Storage privado<br/>documentos-pacientes"]]
    end

    subgraph github["GitHub Actions"]
        ci["CI Backend y Frontend<br/>pruebas, cobertura, auditorías, imagen"]
        respaldo["Respaldo diario cifrado<br/><i>backup.yml → scripts.backup_db</i>"]
    end

    cloudinary[["Cloudinary<br/>galería de fotos y videos"]]
    resend[["Resend<br/>API de correo"]]
    google[["Google Identity<br/>claves públicas JWKS"]]

    navegador -- "HTTPS" --> spa
    navegador -- "REST JSON /api/v1<br/>cookies HttpOnly + X-CSRF-Token" --> api
    navegador -- "sube con la firma de la API" --> cloudinary
    navegador -- "widget" --> turnstile
    api -- "SQLAlchemy + psycopg2<br/>usuario aspar_api (Transaction Pooler)" --> db
    job -- "dueño del esquema (Session Pooler)" --> db
    api -- "service_role · URLs firmadas de 300 s" --> bucket
    api -- "firma subidas · destroy al borrar" --> cloudinary
    api -- "valida el token" --> turnstile
    api -- "envía correos" --> resend
    api -- "verifica el ID token" --> google
    secretos -. "--set-secrets" .-> api
    secretos -. "--set-secrets" .-> job
    respaldo -- "pg_dump --schema=public<br/>usuario aspar_backup" --> db
    respaldo -- "descarga los documentos" --> bucket
    spa -. "nunca accede directo (ADR-007)" .-x db
```

- La SPA solo habla con la API. Las dos únicas conexiones del navegador a terceros son el widget de Turnstile y la subida a Cloudinary, que la API firma antes (`POST /media/albums/{id}/upload-signature`).
- Cloudflare Pages sirve `index.html` en cualquier ruta (SPA con `vue-router`). La API y la SPA comparten el sitio `aspar.com`, por eso las cookies `SameSite=Lax` funcionan sin `SameSite=None`.
- En Docker local, la API, la base y el frontend corren con `docker compose`. La API aplica las migraciones al arrancar; en Cloud Run lo hace el job.

## 4. Nivel C3 — Componentes de la API

Cada módulo de dominio vive en `Backend/app/modules/<dominio>/` y tiene las mismas capas: `router.py` (HTTP y permisos), `service.py` (reglas de negocio y bitácora), `repository.py` (consultas), `models.py` (SQLAlchemy) y `schemas.py` (Pydantic en camelCase). Un módulo usa el **servicio** de otro, nunca su repositorio.

```mermaid
flowchart TB
    cliente["SPA Frontend<br/>src/api (tipos generados de OpenAPI)"]

    subgraph api["API Backend (FastAPI · app/main.py)"]
        direction TB
        subgraph mw["Middlewares"]
            m1["OriginCheck · SecurityHeaders · CORS<br/>request id y registro"]
        end

        subgraph cuentas["Cuentas y acceso"]
            auth["auth<br/>login · Google · registro · sesión"]
            users["users<br/>equipo y aprobación"]
            roles["roles<br/>permisos por rol"]
            audit["audit<br/>único escritor de la bitácora"]
        end

        subgraph afiliados["Afiliados (RNF-06)"]
            patients["patients<br/>fichas y anamnesis"]
            evaluations["evaluations<br/>contactos y evaluaciones"]
            documents["documents<br/>documentos privados"]
        end

        subgraph sede["Actividades e inventario"]
            schedules["schedules<br/>actividades"]
            attendance["attendance<br/>asistencia y resumen"]
            inventory["inventory<br/>materiales y movimientos"]
        end

        subgraph comunidad["Sitio y comunidad"]
            donations["donations<br/>aportes, meta y exportación"]
            media["media<br/>álbumes y etiquetas"]
            institutional["institutional<br/>secciones y redes"]
            inquiries["inquiries<br/>solicitudes e inscripción"]
            dashboard["dashboard<br/>panel de inicio"]
            system["system<br/>/health y /health/db"]
        end

        subgraph core["Núcleo · app/core"]
            c1["config · database (DbSession, after_commit)<br/>security (bcrypt, CSRF) · errors · pagination<br/>rate_limit · clock · spreadsheet · network"]
        end

        subgraph adapters["Adaptadores · app/adapters"]
            a_st["storage<br/>Supabase Storage"]
            a_cl["cloudinary<br/>firma y destroy"]
            a_em["email<br/>Resend / Brevo / consola"]
            a_go["google<br/>ID token"]
            a_tu["turnstile<br/>CAPTCHA"]
        end
    end

    db[("PostgreSQL")]
    ext[["Servicios externos"]]

    cliente --> mw --> cuentas & afiliados & sede & comunidad
    cuentas & afiliados & sede & comunidad --> core
    cuentas & afiliados & sede & comunidad -. "eventos sensibles" .-> audit
    documents --> a_st
    media --> a_cl
    auth --> a_em & a_go & a_tu
    inquiries & donations --> a_tu
    core --> db
    adapters --> ext
```

| Grupo | Módulos | Permisos que usan |
| :--- | :--- | :--- |
| Cuentas y acceso | `auth`, `users`, `roles`, `audit` | `users:manage`, `roles:manage`, `audit:read` |
| Afiliados | `patients`, `evaluations`, `documents` | `patients:read`, `patients:write`, `patients:read_clinical`, `patients:write_clinical`, `patients:deactivate`, `documents:upload`, `documents:delete` |
| Actividades e inventario | `schedules`, `attendance`, `inventory` | `schedules:manage`, `attendance:write`, `inventory:manage` |
| Sitio y comunidad | `donations`, `media`, `institutional`, `inquiries`, `dashboard`, `system` | `donations:manage`, `media:manage`, `content:manage`, `inquiries:manage` (el panel exige cualquier permiso; `/health` es público) |

**Dependencias de la API que cruzan módulos** (`app/modules/auth/dependencies.py`): `get_current_user` valida la cookie contra la tabla `sessions`; `require_permission(*claves, any_of=False)` consulta los permisos del rol en la base y registra en la bitácora cada acceso denegado.

## 5. Modelo Entidad-Relación completo

El modelo tiene **25 tablas** en el esquema `public`, más `schema_migrations`. Por legibilidad se divide en tres diagramas; `users` y `patients` se repiten como referencia.

- Todas las claves primarias son `uuid` (`gen_random_uuid()`), salvo `permissions.key` y `rate_limits (bucket, window_start)`.
- Las columnas `created_at` y `updated_at` existen en casi todas las tablas y se omiten en los diagramas.
- Las referencias de auditoría a `users` (`created_by`, `uploaded_by`, `reviewed_by`, `marked_by`…) son `on delete set null`, para no perder registros si se elimina un usuario. Se dibujan solo las principales.

### 5.1 Cuentas, permisos y seguridad

```mermaid
erDiagram
    roles ||--o{ role_permissions : "tiene"
    permissions ||--o{ role_permissions : "se asigna en"
    roles |o--o{ users : "rol (null = pendiente de aprobación)"
    users ||--o{ sessions : "abre"
    users ||--o{ auth_tokens : "recibe enlaces"

    roles {
        uuid id PK
        text key UK "admin, coordination, professional, reception, volunteer..."
        text name
        text description
        boolean is_system "admin: inmutable (trigger)"
    }
    permissions {
        text key PK "17 claves recurso:acción"
        text description
        boolean is_sensitive "pide confirmación al asignarse"
    }
    role_permissions {
        uuid role_id PK,FK
        text permission_key PK,FK
    }
    users {
        uuid id PK
        text name
        text email UK "único sin distinguir mayúsculas"
        text password_hash "bcrypt costo 12 (o null si solo Google)"
        text google_sub UK
        boolean email_verified
        boolean must_change_password
        timestamptz temp_password_expires_at
        uuid role_id FK
        text department
        boolean active
        int failed_login_attempts
        timestamptz locked_until
        timestamptz last_login_at
        timestamptz password_changed_at
    }
    sessions {
        uuid id PK "sid de la cookie firmada"
        uuid user_id FK
        timestamptz expires_at "30 min, se renueva"
        timestamptz absolute_expires_at "8 h desde el login"
        timestamptz last_activity_at "15 min sin actividad"
        timestamptz refreshed_at
        int refresh_count
        timestamptz revoked_at "logout o cambio de contraseña"
        text ip_address
        text user_agent
    }
    auth_tokens {
        uuid id PK
        uuid user_id FK
        text purpose "verificar_correo o restablecer_contrasena"
        text token_hash UK "SHA-256, nunca el token"
        timestamptz expires_at
        timestamptz used_at "un solo uso"
    }
    rate_limits {
        text bucket PK "p. ej. login:ip:..."
        timestamptz window_start PK
        int hits
        timestamptz expires_at
    }
    audit_logs {
        uuid id PK
        timestamptz date
        text actor "correo, se conserva aunque se borre el usuario"
        text actor_role
        text category
        text severity "INFO, WARNING o CRITICAL"
        text action
        text detail
        text ip_address
        text group_key "agrupa eventos repetidos"
        int occurrences
        timestamptz last_occurred_at
    }
    schema_migrations {
        text version PK "001, 002, 003"
        text name
        text checksum "SHA-256 del archivo aplicado"
        timestamptz applied_at
    }
```

### 5.2 Afiliados, actividades y asistencia

```mermaid
erDiagram
    users |o--o{ patients : "registra"
    patients ||--o{ patient_contacts : "familia o cuidador"
    patients ||--o{ patient_evaluations : "evaluaciones"
    users |o--o{ patient_evaluations : "profesional"
    patients ||--o{ patient_documents : "documentos privados"
    users |o--o{ schedules : "profesional a cargo"
    schedules ||--o{ attendance : "lista"
    patients ||--o{ attendance : "asiste"

    users {
        uuid id PK
        text name
    }
    patients {
        uuid id PK
        text name
        text ci UK "único sin distinguir mayúsculas"
        date birth_date
        text phone
        text address
        text zone
        boolean consent "RNF-06"
        date consent_date
        boolean image_consent "fotos en la galería"
        text access_status "Activo solo con consentimiento (CHECK)"
        text diagnosis "clínico"
        text stage "Hoehn y Yahr · clínico"
        boolean neurologist_certificate "clínico"
        text symptom_notes "clínico"
        text medications "clínico"
        timestamptz deleted_at "baja lógica"
        text deactivation_reason "obligatorio con la baja (CHECK)"
        uuid deactivated_by FK
        uuid created_by FK
    }
    patient_contacts {
        uuid id PK
        uuid patient_id FK
        text name
        text relation
        text phone
        text alt_phone
        boolean is_primary "uno por afiliado (índice único)"
        boolean active
    }
    patient_evaluations {
        uuid id PK
        uuid patient_id FK
        text area "fisica, fonoaudiologica o psicologica"
        date evaluated_on
        uuid professional_id FK
        text professional_name
        text notes
        uuid created_by FK
    }
    patient_documents {
        uuid id PK
        uuid patient_id FK
        text document_type
        text file_name
        text storage_path UK "bucket privado"
        text content_type "pdf, jpeg, png o webp"
        int size_bytes "hasta 10 MB"
        uuid uploaded_by FK
    }
    schedules {
        uuid id PK
        text title
        text category
        date date
        time start_time
        time end_time "mayor que start_time (CHECK)"
        text location
        uuid professional_id FK
        text professional_name
        text description
        int spots "0 a 500 o sin límite"
        text status "borrador, publicada o cancelada"
        text cancellation_note "obligatoria al cancelar (CHECK)"
        text image_url
        timestamptz attendance_closed_at
        uuid attendance_closed_by FK
        uuid created_by FK
    }
    attendance {
        uuid id PK
        uuid schedule_id FK
        uuid patient_id FK
        text status "vino, no_vino o sin_marcar"
        text note
        uuid marked_by FK
        timestamptz marked_at
    }
```

`attendance` tiene `unique (schedule_id, patient_id)`. `patient_documents`, `attendance` y las etiquetas de la galería usan `on delete restrict` hacia `patients`: un afiliado con historial solo se da de baja (baja lógica), nunca se borra.

### 5.3 Inventario, donaciones, galería, contenido y solicitudes

```mermaid
erDiagram
    inventory_items ||--o{ inventory_movements : "historial"
    donation_goals ||--o{ donation_goal_milestones : "hitos"
    donation_goals |o--o{ donations : "suma a la meta"
    inventory_items |o--o{ donations : "aporte en especie"
    schedules |o--o{ media_albums : "álbum de la actividad"
    media_albums ||--o{ media_assets : "fotos y videos"
    media_assets ||--o{ media_patient_tags : "etiquetas"
    patients ||--o{ media_patient_tags : "aparece en"
    schedules |o--o{ inquiries : "quiere participar"
    patients |o--o{ inquiries : "inscrito desde la solicitud"
    users |o--o{ inquiries : "asignada a"
    inquiries ||--o{ inquiry_notes : "seguimiento"

    inventory_items {
        uuid id PK
        text code UK
        text name
        text category
        int quantity "nunca negativa (CHECK)"
        text condition "nuevo, bueno, regular o dañado"
        text origin "propio, donado o alcaldia"
        text donor_or_institution
        date entry_date
        text location
        timestamptz deleted_at "baja con motivo"
        text deactivation_reason
    }
    inventory_movements {
        uuid id PK
        uuid item_id FK
        text movement_type "ingreso, prestamo, devolucion, baja o ajuste"
        int quantity_delta
        text reason
        text counterpart
        uuid user_id FK
    }
    donation_goals {
        uuid id PK
        text title
        text description
        numeric target_bs
        numeric manual_adjustment_bs
        boolean visible "una sola visible (índice único)"
        date starts_on
    }
    donation_goal_milestones {
        uuid id PK
        uuid goal_id FK
        text label
        text status "pendiente, en_camino o cubierto"
        int position
    }
    donations {
        uuid id PK
        text donor_name
        text donor_contact
        text channel "qr_bancario, efectivo o especie"
        text source "sitio o sede"
        numeric amount_bs
        text in_kind_description
        numeric estimated_value_bs
        text purpose
        text status "pendiente, confirmado, recibido o anulado"
        text declared_reference "lo que dice el donante"
        text bank_reference "del extracto · única si está confirmada (003)"
        date credited_on
        text cancellation_reason
        uuid goal_id FK
        uuid inventory_item_id FK
        uuid reviewed_by FK
        date date
    }
    media_albums {
        uuid id PK
        text title
        text description
        text visibility "privado o publico"
        boolean permissions_reviewed "obligatorio para publicar (CHECK)"
        uuid reviewed_by FK
        uuid schedule_id FK
    }
    media_assets {
        uuid id PK
        uuid album_id FK
        text kind "imagen o video"
        text provider "cloudinary"
        text public_id UK
        text url
        text thumbnail_url
        int width
        int height
        int size_bytes
    }
    media_patient_tags {
        uuid asset_id PK,FK
        uuid patient_id PK,FK
        uuid tagged_by FK
    }
    institutional_sections {
        uuid id PK
        text key UK "presentacion, mision_vision, donaciones..."
        text title
        jsonb draft_content "borrador"
        jsonb published_content "lo que ve el público"
        uuid draft_updated_by FK
        uuid published_by FK
    }
    inquiries {
        uuid id PK
        text kind "orientacion, voluntariado, especie, participar..."
        text source "sitio, asistencia o sede"
        text name
        text phone
        text on_behalf_of
        text zone
        text preferred_call_time
        text message
        uuid schedule_id FK "obligatoria si kind = participar"
        text status "recibida, por_contactar, contactada, inscrita..."
        uuid assigned_to FK
        uuid patient_id FK
        boolean contact_consent
    }
    inquiry_notes {
        uuid id PK
        uuid inquiry_id FK
        uuid author_id FK
        text author_name
        text note
    }
    patients {
        uuid id PK
    }
    schedules {
        uuid id PK
    }
    users {
        uuid id PK
    }
```

### 5.4 Migraciones y reglas que no se ven en los diagramas

| Migración | Contenido |
| :--- | :--- |
| [`001_base.sql`](../../Backend/migrations/001_base.sql) | Las 25 tablas, `CHECK`, índices, triggers, RLS activo **sin políticas**, los 5 roles iniciales, las 17 claves de permiso y las 7 secciones del sitio |
| [`002_busqueda_trigram.sql`](../../Backend/migrations/002_busqueda_trigram.sql) | Extensión `pg_trgm` en el esquema `extensions` e índices de búsqueda parcial por nombre y CI de afiliados, nombre y correo del equipo y actor de la bitácora |
| [`003_referencia_bancaria_unica.sql`](../../Backend/migrations/003_referencia_bancaria_unica.sql) | Índice único `donations_referencia_extracto_unica` sobre `lower(bank_reference)` cuando `status = 'confirmado'`: un movimiento del extracto no puede confirmar dos aportes |

- **Bitácora inmutable:** `audit_logs` no admite `UPDATE` ni `DELETE` (trigger, ADR-006).
- **Rol de Administración protegido:** triggers impiden borrar un rol del sistema o quitarle permisos (`roles_proteger`, `role_permissions_proteger_sistema`).
- **Consentimiento:** `patients` no admite `access_status = 'Activo'` sin `consent` (`CHECK`).
- **Acceso:** todas las tablas tienen RLS activo sin políticas y se revocan los permisos de `anon` y `authenticated` (ADR-007). Solo el Backend lee los datos.
- **Concurrencia:** cada regla de unicidad está en la base (CI, correo, `public_id`, referencia bancaria, asistencia por actividad). Si dos peticiones llegan a la vez, la segunda recibe **409** con un mensaje claro; nunca un 500.

## 6. Pendiente

- Reemplazar las imágenes `modelos/c4/*.jpeg` por estas versiones o enlazar este documento como vigente.
- Revisión de los diagramas y de los ADR por la arquitecta del proyecto.
- Aceptar ADR-014 con el primer despliegue real y confirmar la región y los dominios.
