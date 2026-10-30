# Diagramas C4 y Modelo Entidad-Relación Actualizados — Sprint 1 (SCRUM-64 / SCRUM-106)

Los diagramas originales (`modelos/c4/C1.jpeg`, `C2.jpeg`, `C3.jpeg` y `docs/arquitectura/DOCUMENTO_3.pdf`) describen la arquitectura **propuesta**. Este documento los actualiza con lo que realmente quedó implementado en la rama `Sprint1`. Las decisiones que explican cada cambio están en el [registro de ADR](./adr/README.md).

## 1. Cambios respecto de los diagramas originales

| Nivel | Diagrama original | Implementación del Sprint 1 | ADR |
| :--- | :--- | :--- | :--- |
| C1 | Personal ASPAR, público y sistema web; servicios externos de almacenamiento y pagos | Sin cambios. Libélula todavía no está integrada (Sprint 2) | — |
| C2 | SPA Vue 3, API FastAPI, PostgreSQL y Cloud Storage | PostgreSQL **gestionado en Supabase**; el «Cloud Storage» se divide en **Supabase Storage** (bucket privado, documentos de pacientes) y **Cloudinary** (galería multimedia, RNF-10, sprints siguientes) | ADR-002, ADR-007, ADR-010 |
| C3 | JWT Auth Middleware, Routers, Services, Repositories (SQLAlchemy), Adapters | Igual, más **sesiones en servidor**, **bitácora** como servicio transversal y routers de usuarios, bitácora y documentos | ADR-001, ADR-003, ADR-006 |
| Datos | E-R a cargo de la arquitecta | 12 tablas en 2 migraciones SQL versionadas | ADR-002 |

## 2. Nivel C1 — Contexto

```mermaid
flowchart LR
    publico["👥 Público general<br/>(pacientes, familiares, donantes)"]
    personal["👩‍⚕️ Personal ASPAR<br/>(Administrador, Coordinador, Profesional,<br/>Recepción, Voluntario)"]
    sistema["🖥️ Sistema Web ASPAR<br/>Portal público y panel de gestión"]
    storage["🔒 Supabase Storage<br/>(documentos privados de pacientes)"]
    cloudinary["🖼️ Cloudinary<br/>(galería multimedia · RNF-10)"]
    pagos["💳 Pasarela Libélula / QR bancario<br/>(Sprint 2)"]
    redes["📱 Redes sociales<br/>(Facebook, Instagram, TikTok)"]

    publico -- "consulta cronograma, dona" --> sistema
    personal -- "gestiona pacientes, usuarios,<br/>inventario y bitácora" --> sistema
    sistema -- "guarda archivos privados" --> storage
    sistema -. "publica fotos y videos (sprints siguientes)" .-> cloudinary
    sistema -. "procesa donaciones" .-> pagos
    sistema -- "enlaces oficiales" --> redes
```

## 3. Nivel C2 — Contenedores

```mermaid
flowchart TB
    usuario["Navegador del usuario"]

    subgraph aspar["Sistema Web ASPAR"]
        spa["SPA Frontend<br/>Vue 3 + TypeScript + Vite<br/><i>Frontend/</i>"]
        api["API Backend<br/>Python 3.12 + FastAPI<br/><i>Backend/app/</i>"]
    end

    subgraph supabase["Supabase (servicio gestionado)"]
        db[("PostgreSQL 16<br/>12 tablas · RLS sin políticas<br/>migraciones 001 y 002")]
        bucket[["Storage<br/>bucket privado<br/>documentos-pacientes"]]
    end

    cloudinary[["Cloudinary<br/>galería multimedia<br/>(sprints siguientes, RNF-10)"]]

    usuario -- "HTTPS" --> spa
    spa -- "REST JSON /api/v1<br/>Authorization: Bearer JWT" --> api
    api -- "SQLAlchemy + psycopg2" --> db
    api -- "REST con service_role key<br/>URLs firmadas de 300 s" --> bucket
    spa -. "nunca accede directamente (ADR-007)" .-x db
    api -. "carga y URLs públicas<br/>(ADR-010)" .-> cloudinary
```

## 4. Nivel C3 — Componentes de la API

```mermaid
flowchart TB
    cliente["SPA Frontend"]

    subgraph api["API Backend (FastAPI)"]
        direction TB
        subgraph routers["Routers · modules/*/router.py"]
            r_auth["auth<br/>/auth/login · verify · refresh · logout"]
            r_pat["patients<br/>/patients CRUD"]
            r_doc["documents<br/>/patients/{id}/documents"]
            r_usr["users<br/>/users · reset-password"]
            r_aud["audit<br/>GET /audit"]
        end

        deps["Middleware JWT y roles<br/>modules/auth/dependencies.py<br/>get_current_user · require_roles"]

        subgraph services["Services · modules/*/service.py"]
            s_auth["auth<br/>bcrypt · bloqueo 5 intentos"]
            s_pat["patients<br/>reglas RNF-06"]
            s_doc["documents"]
            s_usr["users"]
            s_aud["audit<br/>único escritor de la bitácora"]
        end

        subgraph repos["Repositories · modules/*/repository.py"]
            rp["user · session · patient<br/>document · audit"]
        end

        adapter["Adapter · adapters/storage.py<br/>SupabaseStorage"]
    end

    db[("PostgreSQL")]
    bucket[["Storage privado"]]

    cliente --> routers
    routers --> deps
    r_auth --> s_auth
    r_pat --> s_pat
    r_doc --> s_doc
    r_usr --> s_usr
    r_aud --> s_aud
    s_auth & s_pat & s_doc & s_usr --> s_aud
    services --> repos
    s_doc --> adapter
    repos --> db
    adapter --> bucket
```

## 5. Modelo Entidad-Relación completo

```mermaid
erDiagram
    users ||--o{ sessions : "abre"
    users |o--o{ patients : "registra (created_by)"
    users |o--o{ media_assets : "sube (uploaded_by)"
    users |o--o{ patient_documents : "sube (uploaded_by)"
    patients ||--o{ patient_documents : "tiene"
    patients |o--o{ attendance : "asiste"
    schedules |o--o{ attendance : "agenda"

    users {
        text id PK
        text name
        text email UK "único sin distinguir mayúsculas"
        text password_hash "bcrypt costo 12"
        text role "CHECK 5 roles"
        text department
        boolean active
        int failed_login_attempts
        timestamptz locked_until
        timestamptz last_login_at
    }
    sessions {
        text id PK "sid del JWT"
        text user_id FK
        timestamptz expires_at "30 min"
        timestamptz last_activity_at "15 min"
        int refresh_count
        timestamptz revoked_at "logout"
        text ip_address
    }
    patients {
        text id PK
        text name
        text ci UK
        text phone
        text emergency_contact
        boolean consent "RNF-06"
        date consent_date
        text access_status "Activo, Pendiente o Revocado"
        text diagnosis
        text stage "Hoehn y Yahr"
        text physical_evaluation "solo roles clínicos"
        text speech_evaluation "solo roles clínicos"
        text psychological_evaluation "solo roles clínicos"
        text medications "solo roles clínicos"
        text created_by FK
    }
    patient_documents {
        text id PK
        text patient_id FK
        text document_type
        text storage_path UK "bucket privado"
        text content_type "pdf, jpeg, png, webp"
        int size_bytes "hasta 10 MB"
        text uploaded_by FK
    }
    audit_logs {
        text id PK
        timestamptz date
        text actor "correo"
        text actor_role
        text category
        text severity "INFO, WARNING o CRITICAL"
        text action
        text detail
        text ip_address
    }
    schedules {
        text id PK
        date date
        time time
        text title
        text category
        text professional
        int spots
        boolean published
    }
    attendance {
        text id PK
        text patient_id FK
        text schedule_id FK
        date date
        text status
    }
    inventory_items {
        text id PK
        text code UK
        text name
        int quantity
        text origin "Propio, Donación o Préstamo Alcaldía"
        text condition
    }
    media_assets {
        text id PK
        text title
        text type "Imagen o Video"
        text url
        numeric size_mb
        text uploaded_by FK
    }
    donations {
        text id PK
        text donor_name
        numeric amount_bs "mayor a 0"
        text method
        text status
    }
    institutional_info {
        smallint id PK "fila única"
        text mission
        text_array enrollment_requirements
        text facebook_url
        text instagram_url
        text tiktok_url
    }
    schema_migrations {
        text version PK
        text name
        timestamptz applied_at
    }
```

**Reglas que no se ven en el diagrama:** `audit_logs` no admite `UPDATE` ni `DELETE` (trigger, ADR-006); `patients` no admite `access_status = 'Activo'` sin `consent` (`CHECK`); todas las tablas tienen RLS activo sin políticas (ADR-007). Las tablas `schedules`, `attendance`, `inventory_items`, `media_assets`, `donations` e `institutional_info` ya existen, pero sus endpoints son del Sprint 2.

## 6. Pendiente

- Reemplazar las imágenes `modelos/c4/C2.jpeg` y `C3.jpeg` por versiones que incluyan Supabase y las sesiones en servidor, o enlazar este documento como versión vigente.
- Revisión de estos diagramas y de los ADR por la arquitecta del proyecto.
- Al implementar RF-05, agregar al C3 un adaptador de Cloudinary junto a `adapters/storage.py` (ADR-010).
