-- =============================================================================
-- ASPAR — Asociación de Parkinson "Mario Lagrava"
-- Migración 001: esquema base completo (Sprint 2)
--
-- Reemplaza a las migraciones del Sprint 1. Todas las tablas usan UUID generados
-- por el servidor, límites de largo en cada texto y baja lógica donde el SRS pide
-- que nada se borre (pacientes, inventario, donaciones).
--
-- NO crea usuarios: el primer Administrador se crea con
--     python -m scripts.create_admin
-- y los datos de prueba (solo fuera de producción) con
--     python -m scripts.seed_demo
--
-- Solo siembra catálogos que el sistema necesita para funcionar: roles, permisos
-- y las secciones del contenido institucional (vacías).
--
-- Regla: una vez aplicada en una base compartida, esta migración no se edita.
-- Los cambios van en 002_..., 003_... (scripts.migrate verifica el checksum).
-- =============================================================================

-- updated_at al día en cada UPDATE
create or replace function public.set_updated_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

-- =============================================================================
-- RF-11  Roles y permisos (dinámicos, administrables desde el panel)
-- =============================================================================
create table public.roles (
  id           uuid primary key default gen_random_uuid(),
  key          text not null unique check (key ~ '^[a-z_]{3,30}$'),
  name         text not null check (length(trim(name)) between 3 and 60),
  description  text not null default '' check (length(description) <= 300),
  is_system    boolean not null default false,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now()
);

create table public.permissions (
  key           text primary key check (key ~ '^[a-z_]+:[a-z_]+$' and length(key) <= 60),
  description   text not null check (length(description) between 3 and 200),
  -- Permisos que dan acceso a datos clínicos o al control del sistema: el panel
  -- muestra una advertencia antes de dárselos a un rol
  is_sensitive  boolean not null default false
);

create table public.role_permissions (
  role_id         uuid not null references public.roles (id) on delete cascade,
  permission_key  text not null references public.permissions (key) on delete cascade,
  primary key (role_id, permission_key)
);

create trigger roles_updated_at
  before update on public.roles
  for each row execute function public.set_updated_at();

-- La clave de un rol nunca cambia y el rol del sistema (admin) no se modifica ni pierde
-- permisos: así Administración no puede quedarse fuera por error.
create or replace function public.proteger_roles()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if tg_op = 'DELETE' and old.is_system then
    raise exception 'El rol del sistema % no se puede eliminar', old.key;
  end if;
  if tg_op = 'UPDATE' and (new.key <> old.key or new.is_system <> old.is_system) then
    raise exception 'La clave y el carácter de sistema de un rol no se pueden cambiar';
  end if;
  return coalesce(new, old);
end;
$$;

create trigger roles_proteger
  before update or delete on public.roles
  for each row execute function public.proteger_roles();

create or replace function public.proteger_permisos_de_sistema()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if exists (select 1 from public.roles r where r.id = old.role_id and r.is_system) then
    raise exception 'Los permisos del rol del sistema no se pueden quitar';
  end if;
  return old;
end;
$$;

create trigger role_permissions_proteger_sistema
  before delete on public.role_permissions
  for each row execute function public.proteger_permisos_de_sistema();

-- =============================================================================
-- RF-01 / RNF-02  Usuarios, sesiones, tokens de correo y límites de peticiones
-- =============================================================================
create table public.users (
  id                         uuid primary key default gen_random_uuid(),
  name                       text not null check (length(trim(name)) between 3 and 120),
  email                      text not null
                             check (length(email) <= 150 and email ~ '^[^@[:space:]]+@[^@[:space:]]+\.[^@[:space:]]+$'),
  password_hash              text check (length(password_hash) <= 255),
  -- Identificador de la cuenta de Google ("Continuar con Google")
  google_sub                 text unique check (length(google_sub) <= 255),
  email_verified             boolean not null default false,
  -- La contraseña temporal entregada por Administración debe cambiarse al ingresar
  must_change_password       boolean not null default false,
  temp_password_expires_at   timestamptz,
  -- NULL = cuenta "Pendiente de aprobación": puede iniciar sesión pero no ve el panel
  role_id                    uuid references public.roles (id) on delete restrict,
  department                 text not null default 'General' check (length(department) <= 80),
  active                     boolean not null default true,
  failed_login_attempts      integer not null default 0 check (failed_login_attempts >= 0),
  locked_until               timestamptz,
  last_login_at              timestamptz,
  password_changed_at        timestamptz,
  created_at                 timestamptz not null default now(),
  updated_at                 timestamptz not null default now(),
  -- Toda cuenta tiene al menos una forma de ingresar
  constraint users_metodo_de_acceso check (password_hash is not null or google_sub is not null)
);

create unique index users_email_unique on public.users (lower(email));
create index users_role_idx on public.users (role_id);

create trigger users_updated_at
  before update on public.users
  for each row execute function public.set_updated_at();

-- Sesiones en servidor: el token solo identifica la sesión; la revocación, la
-- inactividad (15 min) y el tope absoluto (8 h) se controlan aquí.
create table public.sessions (
  id                   uuid primary key default gen_random_uuid(),
  user_id              uuid not null references public.users (id) on delete cascade,
  created_at           timestamptz not null default now(),
  expires_at           timestamptz not null,
  absolute_expires_at  timestamptz not null,
  last_activity_at     timestamptz not null,
  refreshed_at         timestamptz,
  refresh_count        integer not null default 0 check (refresh_count >= 0),
  revoked_at           timestamptz,
  ip_address           text check (length(ip_address) <= 45),
  user_agent           text check (length(user_agent) <= 300),
  check (expires_at <= absolute_expires_at)
);

create index sessions_user_idx on public.sessions (user_id);
create index sessions_active_idx on public.sessions (expires_at) where revoked_at is null;

-- Enlaces de verificación de correo y de recuperación de contraseña.
-- Solo se guarda el SHA-256 del token: el token en claro viaja únicamente en el correo.
create table public.auth_tokens (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null references public.users (id) on delete cascade,
  purpose     text not null check (purpose in ('verificar_correo', 'restablecer_contrasena')),
  token_hash  text not null unique check (token_hash ~ '^[0-9a-f]{64}$'),
  expires_at  timestamptz not null,
  used_at     timestamptz,
  created_at  timestamptz not null default now()
);

create index auth_tokens_user_idx on public.auth_tokens (user_id, purpose);

-- Contadores de límite de peticiones por IP o cuenta, compartidos por todas las
-- instancias de la API (Cloud Run puede levantar varias).
create table public.rate_limits (
  bucket        text not null check (length(bucket) between 3 and 200),
  window_start  timestamptz not null,
  hits          integer not null default 0 check (hits >= 0),
  expires_at    timestamptz not null,
  primary key (bucket, window_start)
);

create index rate_limits_expires_idx on public.rate_limits (expires_at);

-- =============================================================================
-- RF-17  Bitácora de auditoría (inmutable)
-- =============================================================================
create table public.audit_logs (
  id                uuid primary key default gen_random_uuid(),
  date              timestamptz not null default now(),
  actor             text not null check (length(actor) between 1 and 150),
  actor_role        text not null check (length(actor_role) between 1 and 60),
  category          text not null
                    check (category in ('AUTENTICACION', 'PACIENTES', 'CONSENTIMIENTO',
                                        'USUARIOS_ROLES', 'INVENTARIO', 'CRONOGRAMA',
                                        'ASISTENCIA', 'DONACIONES', 'GALERIA', 'CONTENIDO',
                                        'SOLICITUDES', 'SISTEMA')),
  severity          text not null check (severity in ('INFO', 'WARNING', 'CRITICAL')),
  action            text not null check (length(action) between 3 and 150),
  detail            text not null check (length(detail) <= 2000),
  ip_address        text check (length(ip_address) <= 45),
  -- Eventos repetidos (por ejemplo, intentos fallidos) se agrupan en una sola fila
  group_key         text check (length(group_key) <= 200),
  occurrences       integer not null default 1 check (occurrences >= 1),
  last_occurred_at  timestamptz not null default now()
);

create index audit_logs_date_idx on public.audit_logs (date desc);
create index audit_logs_filters_idx on public.audit_logs (category, severity);
create index audit_logs_group_idx on public.audit_logs (group_key, last_occurred_at desc)
  where group_key is not null;

-- Nada se borra ni se edita. Única excepción: sumar repeticiones a un evento agrupado.
create or replace function public.audit_logs_inmutable()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if tg_op = 'UPDATE'
     and old.group_key is not null
     and new.id = old.id and new.date = old.date and new.actor = old.actor
     and new.actor_role = old.actor_role and new.category = old.category
     and new.severity = old.severity and new.action = old.action
     and new.detail = old.detail
     and new.ip_address is not distinct from old.ip_address
     and new.group_key = old.group_key
     and new.occurrences > old.occurrences then
    return new;
  end if;
  raise exception 'La bitácora de auditoría no se puede modificar ni eliminar (RF-17)';
end;
$$;

create trigger audit_logs_no_update_delete
  before update or delete on public.audit_logs
  for each row execute function public.audit_logs_inmutable();

-- =============================================================================
-- RF-02 / RNF-06  Afiliados (pacientes), familiares, evaluaciones y documentos
-- =============================================================================
create table public.patients (
  id                       uuid primary key default gen_random_uuid(),
  name                     text not null check (length(trim(name)) between 3 and 120),
  ci                       text not null check (ci ~ '^[0-9]{5,10}(-[0-9A-Za-z]{1,3})?$'),
  birth_date               date,
  phone                    text not null check (phone ~ '^[0-9]{7,12}$'),
  address                  text not null default '' check (length(address) <= 200),
  zone                     text not null default '' check (length(zone) <= 80),
  consent                  boolean not null default false,
  consent_date             date,
  -- Permiso de uso de imagen: la galería solo publica a quienes lo firmaron
  image_consent            boolean not null default false,
  access_status            text not null default 'Pendiente'
                           check (access_status in ('Activo', 'Pendiente', 'Revocado')),
  -- Anamnesis base (las evaluaciones de seguimiento van en patient_evaluations)
  diagnosis                text not null default '' check (length(diagnosis) <= 200),
  stage                    text not null default 'Estadio I (Leve unilateral)'
                           check (stage in (
                             'Estadio I (Leve unilateral)',
                             'Estadio II (Bilateral sin alteración del equilibrio)',
                             'Estadio III (Moderado con inestabilidad postural)',
                             'Estadio IV (Incapacidad grave pero camina con ayuda)',
                             'Estadio V (Dependencia completa)',
                             'Otro trastorno del movimiento')),
  neurologist_certificate  boolean not null default false,
  symptom_notes            text not null default '' check (length(symptom_notes) <= 4000),
  medications              text not null default '' check (length(medications) <= 2000),
  -- Baja lógica: nada se elimina físicamente (SRS, reglas de negocio)
  deleted_at               timestamptz,
  deactivation_reason      text check (length(trim(deactivation_reason)) between 3 and 300),
  deactivated_by           uuid references public.users (id) on delete set null,
  created_by               uuid references public.users (id) on delete set null,
  created_at               timestamptz not null default now(),
  updated_at               timestamptz not null default now(),
  -- RNF-06: no hay acceso clínico activo sin consentimiento
  constraint patients_activo_requiere_consentimiento check (access_status <> 'Activo' or consent),
  constraint patients_baja_con_motivo check ((deleted_at is null) = (deactivation_reason is null))
);

-- Un carnet, una persona (también entre las fichas dadas de baja)
create unique index patients_ci_unique on public.patients (lower(ci));
create index patients_access_idx on public.patients (access_status) where deleted_at is null;
create index patients_created_idx on public.patients (created_at desc);

create trigger patients_updated_at
  before update on public.patients
  for each row execute function public.set_updated_at();

create table public.patient_contacts (
  id          uuid primary key default gen_random_uuid(),
  patient_id  uuid not null references public.patients (id) on delete cascade,
  name        text not null check (length(trim(name)) between 3 and 120),
  relation    text not null check (length(trim(relation)) between 2 and 60),
  phone       text not null check (phone ~ '^[0-9]{7,12}$'),
  alt_phone   text check (alt_phone ~ '^[0-9]{7,12}$'),
  is_primary  boolean not null default false,
  active      boolean not null default true,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

create index patient_contacts_patient_idx on public.patient_contacts (patient_id);
-- Un solo contacto principal activo por ficha
create unique index patient_contacts_un_principal on public.patient_contacts (patient_id)
  where is_primary and active;

create trigger patient_contacts_updated_at
  before update on public.patient_contacts
  for each row execute function public.set_updated_at();

create table public.patient_evaluations (
  id                 uuid primary key default gen_random_uuid(),
  patient_id         uuid not null references public.patients (id) on delete cascade,
  area               text not null check (area in ('fisica', 'fonoaudiologica', 'psicologica')),
  evaluated_on       date not null,
  professional_id    uuid references public.users (id) on delete set null,
  professional_name  text not null check (length(trim(professional_name)) between 3 and 120),
  notes              text not null check (length(trim(notes)) between 3 and 4000),
  created_by         uuid references public.users (id) on delete set null,
  created_at         timestamptz not null default now(),
  updated_at         timestamptz not null default now()
);

create index patient_evaluations_patient_idx
  on public.patient_evaluations (patient_id, evaluated_on desc);

create trigger patient_evaluations_updated_at
  before update on public.patient_evaluations
  for each row execute function public.set_updated_at();

-- Archivos en un bucket PRIVADO de Supabase Storage; aquí solo la metadata
create table public.patient_documents (
  id             uuid primary key default gen_random_uuid(),
  patient_id     uuid not null references public.patients (id) on delete restrict,
  document_type  text not null
                 check (document_type in ('CI', 'Certificado neurológico', 'Evaluación clínica',
                                          'Consentimiento informado', 'Otro')),
  file_name      text not null check (length(file_name) between 1 and 120),
  storage_path   text not null unique check (length(storage_path) <= 200),
  content_type   text not null
                 check (content_type in ('application/pdf', 'image/jpeg', 'image/png', 'image/webp')),
  size_bytes     integer not null check (size_bytes > 0 and size_bytes <= 10485760),
  uploaded_by    uuid references public.users (id) on delete set null,
  uploaded_at    timestamptz not null default now()
);

create index patient_documents_patient_idx
  on public.patient_documents (patient_id, uploaded_at desc);

-- =============================================================================
-- RF-04 / RF-10 / RF-12  Actividades y asistencia de los afiliados
-- =============================================================================
create table public.schedules (
  id                    uuid primary key default gen_random_uuid(),
  title                 text not null check (length(trim(title)) between 3 and 120),
  category              text not null
                        check (category in ('fisioterapia', 'arteterapia', 'fonoaudiologia',
                                            'psicologia', 'teatro', 'familias', 'comunitario')),
  date                  date not null,
  start_time            time not null,
  end_time              time not null,
  location              text not null check (length(trim(location)) between 3 and 120),
  professional_id       uuid references public.users (id) on delete set null,
  professional_name     text not null default '' check (length(professional_name) <= 120),
  description           text not null default '' check (length(description) <= 1000),
  -- Cupos informativos: no hay sistema de reservas
  spots                 integer check (spots between 0 and 500),
  status                text not null default 'borrador'
                        check (status in ('borrador', 'publicada', 'cancelada')),
  -- Aviso que se muestra en el sitio cuando se cancela (p. ej. "Se reprograma en diciembre")
  cancellation_note     text check (length(trim(cancellation_note)) between 3 and 300),
  image_url             text check (length(image_url) <= 500),
  attendance_closed_at  timestamptz,
  attendance_closed_by  uuid references public.users (id) on delete set null,
  created_by            uuid references public.users (id) on delete set null,
  created_at            timestamptz not null default now(),
  updated_at            timestamptz not null default now(),
  check (end_time > start_time),
  check (status <> 'cancelada' or cancellation_note is not null)
);

create index schedules_date_idx on public.schedules (date, start_time);

create trigger schedules_updated_at
  before update on public.schedules
  for each row execute function public.set_updated_at();

create table public.attendance (
  id           uuid primary key default gen_random_uuid(),
  schedule_id  uuid not null references public.schedules (id) on delete restrict,
  patient_id   uuid not null references public.patients (id) on delete restrict,
  status       text not null default 'sin_marcar' check (status in ('vino', 'no_vino', 'sin_marcar')),
  note         text not null default '' check (length(note) <= 300),
  marked_by    uuid references public.users (id) on delete set null,
  marked_at    timestamptz,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now(),
  unique (schedule_id, patient_id)
);

create index attendance_patient_idx on public.attendance (patient_id);

create trigger attendance_updated_at
  before update on public.attendance
  for each row execute function public.set_updated_at();

-- =============================================================================
-- RF-03 / RF-09 / RF-13  Inventario (SRS v2.0) e historial de movimientos
-- =============================================================================
create table public.inventory_items (
  id                    uuid primary key default gen_random_uuid(),
  code                  text unique check (length(code) between 2 and 30),
  name                  text not null check (length(trim(name)) between 2 and 120),
  category              text not null
                        check (category in ('fisioterapia', 'movilidad', 'mobiliario',
                                            'papeleria', 'otro')),
  quantity              integer not null check (quantity >= 0),
  condition             text not null check (condition in ('nuevo', 'bueno', 'regular', 'dañado')),
  origin                text not null check (origin in ('propio', 'donado', 'alcaldia')),
  donor_or_institution  text not null default '' check (length(donor_or_institution) <= 120),
  entry_date            date not null default current_date,
  location              text not null default '' check (length(location) <= 120),
  deleted_at            timestamptz,
  deactivation_reason   text check (length(trim(deactivation_reason)) between 3 and 300),
  created_by            uuid references public.users (id) on delete set null,
  created_at            timestamptz not null default now(),
  updated_at            timestamptz not null default now(),
  constraint inventory_baja_con_motivo check ((deleted_at is null) = (deactivation_reason is null))
);

create index inventory_items_origin_idx on public.inventory_items (origin) where deleted_at is null;
create index inventory_items_condition_idx on public.inventory_items (condition)
  where deleted_at is null;

create trigger inventory_items_updated_at
  before update on public.inventory_items
  for each row execute function public.set_updated_at();

create table public.inventory_movements (
  id              uuid primary key default gen_random_uuid(),
  item_id         uuid not null references public.inventory_items (id) on delete restrict,
  movement_type   text not null
                  check (movement_type in ('ingreso', 'prestamo', 'devolucion', 'baja', 'ajuste')),
  -- Positivo suma al stock (ingreso, devolución) y negativo resta (préstamo, baja)
  quantity_delta  integer not null check (quantity_delta <> 0),
  reason          text not null default '' check (length(reason) <= 300),
  counterpart     text not null default '' check (length(counterpart) <= 120),
  user_id         uuid references public.users (id) on delete set null,
  created_at      timestamptz not null default now()
);

create index inventory_movements_item_idx on public.inventory_movements (item_id, created_at desc);

-- =============================================================================
-- RF-06 / RF-14 / RF-15  Donaciones (QR bancario, efectivo y en especie) y meta
-- =============================================================================
create table public.donation_goals (
  id                    uuid primary key default gen_random_uuid(),
  title                 text not null check (length(trim(title)) between 3 and 120),
  description           text not null default '' check (length(description) <= 300),
  target_bs             numeric(12, 2) not null check (target_bs > 0),
  -- SRS RF-15: acumulado = aportes confirmados + ajustes manuales
  manual_adjustment_bs  numeric(12, 2) not null default 0,
  visible               boolean not null default false,
  starts_on             date not null default current_date,
  created_at            timestamptz not null default now(),
  updated_at            timestamptz not null default now()
);

-- Solo una meta visible en el sitio a la vez
create unique index donation_goals_una_visible on public.donation_goals ((true)) where visible;

create trigger donation_goals_updated_at
  before update on public.donation_goals
  for each row execute function public.set_updated_at();

create table public.donation_goal_milestones (
  id        uuid primary key default gen_random_uuid(),
  goal_id   uuid not null references public.donation_goals (id) on delete cascade,
  label     text not null check (length(trim(label)) between 3 and 80),
  status    text not null default 'pendiente' check (status in ('pendiente', 'en_camino', 'cubierto')),
  position  integer not null default 0 check (position >= 0)
);

create index donation_goal_milestones_goal_idx on public.donation_goal_milestones (goal_id, position);

create table public.donations (
  id                   uuid primary key default gen_random_uuid(),
  -- NULL = aporte anónimo
  donor_name           text check (length(trim(donor_name)) between 2 and 120),
  donor_contact        text check (length(donor_contact) <= 120),
  channel              text not null check (channel in ('qr_bancario', 'efectivo', 'especie')),
  source               text not null default 'sitio' check (source in ('sitio', 'sede')),
  amount_bs            numeric(12, 2) check (amount_bs > 0 and amount_bs <= 100000),
  in_kind_description  text check (length(trim(in_kind_description)) between 3 and 300),
  estimated_value_bs   numeric(12, 2) check (estimated_value_bs > 0),
  purpose              text not null default 'Donde más se necesite' check (length(purpose) <= 120),
  status               text not null
                       check (status in ('pendiente', 'confirmado', 'recibido', 'anulado')),
  -- Comprobante que declaró el donante y referencia hallada en el extracto bancario
  declared_reference   text check (length(declared_reference) <= 60),
  bank_reference       text check (length(bank_reference) <= 60),
  credited_on          date,
  cancellation_reason  text check (length(trim(cancellation_reason)) between 3 and 300),
  goal_id              uuid references public.donation_goals (id) on delete set null,
  inventory_item_id    uuid references public.inventory_items (id) on delete set null,
  registered_by        uuid references public.users (id) on delete set null,
  reviewed_by          uuid references public.users (id) on delete set null,
  reviewed_at          timestamptz,
  date                 date not null default current_date,
  created_at           timestamptz not null default now(),
  updated_at           timestamptz not null default now(),
  -- Dinero con monto; especie con descripción
  constraint donations_monto_o_especie check (
    (channel = 'especie' and in_kind_description is not null and amount_bs is null)
    or (channel <> 'especie' and amount_bs is not null and in_kind_description is null)
  ),
  -- Regla de estados por canal
  constraint donations_estado_por_canal check (
    (channel = 'qr_bancario' and status in ('pendiente', 'confirmado', 'anulado'))
    or (channel = 'efectivo' and status in ('confirmado', 'anulado'))
    or (channel = 'especie' and status in ('recibido', 'anulado'))
  ),
  constraint donations_anulado_con_motivo check ((status = 'anulado') = (cancellation_reason is not null)),
  constraint donations_qr_confirmado_con_extracto check (
    channel <> 'qr_bancario' or status <> 'confirmado'
    or (bank_reference is not null and credited_on is not null)
  )
);

create index donations_status_idx on public.donations (status, date desc);
create index donations_goal_idx on public.donations (goal_id) where status = 'confirmado';

create trigger donations_updated_at
  before update on public.donations
  for each row execute function public.set_updated_at();

-- =============================================================================
-- RF-05  Galería (archivos en Cloudinary) con revisión de permisos de imagen
-- =============================================================================
create table public.media_albums (
  id                     uuid primary key default gen_random_uuid(),
  title                  text not null check (length(trim(title)) between 3 and 120),
  description            text not null default '' check (length(description) <= 500),
  visibility             text not null default 'privado' check (visibility in ('privado', 'publico')),
  -- "Revisé que todas las personas que se reconocen dieron su permiso"
  permissions_reviewed   boolean not null default false,
  reviewed_by            uuid references public.users (id) on delete set null,
  reviewed_at            timestamptz,
  schedule_id            uuid references public.schedules (id) on delete set null,
  created_by             uuid references public.users (id) on delete set null,
  created_at             timestamptz not null default now(),
  updated_at             timestamptz not null default now(),
  constraint media_albums_publicar_con_revision check (visibility = 'privado' or permissions_reviewed)
);

create trigger media_albums_updated_at
  before update on public.media_albums
  for each row execute function public.set_updated_at();

create table public.media_assets (
  id             uuid primary key default gen_random_uuid(),
  album_id       uuid not null references public.media_albums (id) on delete cascade,
  kind           text not null check (kind in ('imagen', 'video')),
  provider       text not null default 'cloudinary' check (provider in ('cloudinary')),
  public_id      text not null unique check (length(public_id) between 1 and 255),
  url            text not null check (length(url) <= 500),
  thumbnail_url  text check (length(thumbnail_url) <= 500),
  width          integer check (width > 0),
  height         integer check (height > 0),
  size_bytes     integer not null check (size_bytes > 0),
  uploaded_by    uuid references public.users (id) on delete set null,
  uploaded_at    timestamptz not null default now()
);

create index media_assets_album_idx on public.media_assets (album_id, uploaded_at);

-- Etiquetas opcionales de afiliados que aparecen en una foto o video
create table public.media_patient_tags (
  asset_id    uuid not null references public.media_assets (id) on delete cascade,
  patient_id  uuid not null references public.patients (id) on delete restrict,
  tagged_by   uuid references public.users (id) on delete set null,
  created_at  timestamptz not null default now(),
  primary key (asset_id, patient_id)
);

create index media_patient_tags_patient_idx on public.media_patient_tags (patient_id);

-- =============================================================================
-- RF-07 / RF-08  Contenido institucional por sección (borrador y publicado)
-- =============================================================================
create table public.institutional_sections (
  id                 uuid primary key default gen_random_uuid(),
  key                text not null unique check (key ~ '^[a-z_]{3,40}$'),
  title              text not null check (length(trim(title)) between 3 and 150),
  draft_content      jsonb not null default '{}'::jsonb
                     check (jsonb_typeof(draft_content) = 'object'
                            and octet_length(draft_content::text) <= 20000),
  published_content  jsonb
                     check (published_content is null
                            or (jsonb_typeof(published_content) = 'object'
                                and octet_length(published_content::text) <= 20000)),
  draft_updated_by   uuid references public.users (id) on delete set null,
  draft_updated_at   timestamptz,
  published_by       uuid references public.users (id) on delete set null,
  published_at       timestamptz,
  created_at         timestamptz not null default now(),
  updated_at         timestamptz not null default now()
);

create trigger institutional_sections_updated_at
  before update on public.institutional_sections
  for each row execute function public.set_updated_at();

-- =============================================================================
-- RF-16  Solicitudes (contacto, voluntariado, participación) y su seguimiento
-- =============================================================================
create table public.inquiries (
  id                   uuid primary key default gen_random_uuid(),
  kind                 text not null
                       check (kind in ('orientacion', 'voluntariado', 'especie', 'participar',
                                       'asistencia', 'otro')),
  -- sitio: formulario público · asistencia: persona nueva anotada un sábado · sede
  source               text not null default 'sitio' check (source in ('sitio', 'asistencia', 'sede')),
  name                 text not null check (length(trim(name)) between 3 and 120),
  phone                text not null check (phone ~ '^[0-9]{7,12}$'),
  on_behalf_of         text not null default '' check (length(on_behalf_of) <= 120),
  zone                 text not null default '' check (length(zone) <= 80),
  preferred_call_time  text not null default '' check (length(preferred_call_time) <= 60),
  message              text not null default '' check (length(message) <= 1000),
  schedule_id          uuid references public.schedules (id) on delete set null,
  status               text not null default 'recibida'
                       check (status in ('recibida', 'por_contactar', 'contactada', 'inscrita',
                                         'cerrada')),
  assigned_to          uuid references public.users (id) on delete set null,
  -- Ficha creada con "Inscribir como afiliado"
  patient_id           uuid references public.patients (id) on delete set null,
  contact_consent      boolean not null default false,
  created_at           timestamptz not null default now(),
  updated_at           timestamptz not null default now(),
  constraint inquiries_participar_con_actividad check (kind <> 'participar' or schedule_id is not null)
);

create index inquiries_status_idx on public.inquiries (status, created_at desc);

create trigger inquiries_updated_at
  before update on public.inquiries
  for each row execute function public.set_updated_at();

create table public.inquiry_notes (
  id           uuid primary key default gen_random_uuid(),
  inquiry_id   uuid not null references public.inquiries (id) on delete cascade,
  author_id    uuid references public.users (id) on delete set null,
  author_name  text not null check (length(trim(author_name)) between 1 and 120),
  note         text not null check (length(trim(note)) between 1 and 2000),
  created_at   timestamptz not null default now()
);

create index inquiry_notes_inquiry_idx on public.inquiry_notes (inquiry_id, created_at);

-- =============================================================================
-- SEGURIDAD (Supabase)
-- La API se conecta con su propio usuario de base de datos, que no pasa por RLS.
-- Se activa RLS SIN políticas y se quitan los permisos de la API pública de
-- Supabase (anon / authenticated): nadie puede leer datos con la "anon key".
-- =============================================================================
do $$
declare
  t text;
begin
  foreach t in array array[
    'roles', 'permissions', 'role_permissions', 'users', 'sessions', 'auth_tokens',
    'rate_limits', 'audit_logs', 'patients', 'patient_contacts', 'patient_evaluations',
    'patient_documents', 'schedules', 'attendance', 'inventory_items', 'inventory_movements',
    'donation_goals', 'donation_goal_milestones', 'donations', 'media_albums', 'media_assets',
    'media_patient_tags', 'institutional_sections', 'inquiries', 'inquiry_notes'
  ] loop
    execute format('alter table public.%I enable row level security', t);
    if exists (select 1 from pg_roles where rolname = 'anon') then
      execute format('revoke all on public.%I from anon, authenticated', t);
    end if;
  end loop;

  -- Bucket privado de documentos (el esquema storage solo existe en Supabase)
  if exists (select 1 from information_schema.tables
             where table_schema = 'storage' and table_name = 'buckets') then
    insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
    values ('documentos-pacientes', 'documentos-pacientes', false, 10485760,
            array['application/pdf', 'image/jpeg', 'image/png', 'image/webp'])
    on conflict (id) do update set public = false;
  end if;
end;
$$;

-- =============================================================================
-- CATÁLOGOS INICIALES (sin usuarios ni datos personales)
-- =============================================================================
insert into public.roles (key, name, description, is_system) values
  ('admin',        'Administración', 'Control total: equipo, permisos y registro de actividad', true),
  ('coordination', 'Coordinación',   'Organiza actividades, contenido, donaciones y solicitudes', false),
  ('professional', 'Profesional',    'Atención clínica: historia, evaluaciones y documentos', false),
  ('reception',    'Recepción',      'Registra afiliados y atiende solicitudes y donaciones', false),
  ('volunteer',    'Voluntariado',   'Toma asistencia y ve datos de contacto, sin datos clínicos', false);

insert into public.permissions (key, description, is_sensitive) values
  ('patients:read',           'Ver afiliados y sus datos de contacto', false),
  ('patients:write',          'Registrar y editar fichas (filiación y consentimiento)', false),
  ('patients:read_clinical',  'Ver historia clínica, evaluaciones y documentos privados', true),
  ('patients:write_clinical', 'Registrar síntomas, medicación y evaluaciones', true),
  ('patients:deactivate',     'Dar de baja o reactivar una ficha', true),
  ('documents:upload',        'Subir documentos privados a una ficha', false),
  ('documents:delete',        'Eliminar documentos privados', true),
  ('attendance:write',        'Tomar y cerrar la asistencia de las actividades', false),
  ('schedules:manage',        'Crear, publicar y cancelar actividades', false),
  ('inventory:manage',        'Registrar materiales, movimientos y bajas de inventario', false),
  ('donations:manage',        'Confirmar, anular y registrar aportes y editar la meta', false),
  ('inquiries:manage',        'Atender solicitudes e inscribir afiliados', false),
  ('media:manage',            'Gestionar la galería y publicar álbumes', false),
  ('content:manage',          'Editar y publicar el contenido del sitio', false),
  ('users:manage',            'Gestionar el equipo, aprobar cuentas y asignar roles', true),
  ('roles:manage',            'Cambiar los permisos de los roles', true),
  ('audit:read',              'Consultar el registro de actividad', true);

-- Permisos iniciales según la tabla "Qué puede ver cada rol" del diseño (pág. 18).
-- Administración modifica después los de los roles que no son del sistema.
insert into public.role_permissions (role_id, permission_key)
select r.id, p.key
from public.roles r
join public.permissions p on
  r.key = 'admin'
  or (r.key = 'coordination' and p.key in (
       'patients:read', 'patients:write', 'patients:read_clinical', 'patients:write_clinical',
       'documents:upload', 'attendance:write', 'schedules:manage', 'inventory:manage',
       'donations:manage', 'inquiries:manage', 'media:manage', 'content:manage'))
  or (r.key = 'professional' and p.key in (
       'patients:read', 'patients:write', 'patients:read_clinical', 'patients:write_clinical',
       'documents:upload', 'attendance:write'))
  or (r.key = 'reception' and p.key in (
       'patients:read', 'patients:write', 'documents:upload', 'attendance:write',
       'donations:manage', 'inquiries:manage'))
  or (r.key = 'volunteer' and p.key in ('patients:read', 'attendance:write'));

insert into public.institutional_sections (key, title) values
  ('presentacion',         'Presentación'),
  ('mision_vision',        'Misión y visión'),
  ('historia',             'Nuestra historia'),
  ('como_participar',      'Cómo participar'),
  ('preguntas_frecuentes', 'Preguntas frecuentes'),
  ('donaciones',           'Datos para donar (QR bancario)'),
  ('redes_contacto',       'Redes sociales y contacto');
