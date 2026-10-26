-- =============================================================================
-- ASPAR — Asociación de Parkinson "Mario Lagrava"
-- Base de datos PostgreSQL para Supabase
--
-- Arquitectura (C2/C3):  Vue 3  ->  FastAPI (/api/v1)  ->  Supabase PostgreSQL
-- El frontend NO se conecta directo a Supabase: todo pasa por FastAPI.
--
-- Basado en la rama Sprint1 (incluye todas las ramas SCRUM-*).
-- Nombres de tablas y columnas iguales a Backend/app/main.py y
-- Frontend/src/types/aspar.ts:
--   users            -> User                (RF-01, RF-11)
--   sessions         -> Session             (RNF-02)
--   patients         -> Patient + ClinicalAnamnesis (RF-02, RNF-06)
--   audit_logs       -> AuditEvent          (RF-17)
--   schedules        -> ScheduleItem        (RF-04, RF-10)
--   attendance       -> AttendanceEntry     (RF-12 a RF-16)
--   inventory_items  -> InventoryItem       (RF-03, RF-09)
--   media_assets     -> MediaAsset          (RF-05)
--   donations        -> DonationRecord      (RF-06)
--   institutional_info -> InstitutionalInfo (RF-07, RF-08)
--
-- Migración 001 (SCRUM-64 / SCRUM-104). Se aplica con: python -m scripts.migrate
-- o una sola vez en: Supabase -> SQL Editor -> New query -> Run
-- =============================================================================

create extension if not exists pgcrypto with schema extensions;

-- Mantiene updated_at al día en cada UPDATE.
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

-- -----------------------------------------------------------------------------
-- RF-01 / RF-11  Usuarios y roles
-- password_hash: bcrypt (RNF-02). En FastAPI usar la librería bcrypt
-- (ya está en requirements.txt) en lugar de sha256.
-- -----------------------------------------------------------------------------
create table public.users (
  id                     text primary key default gen_random_uuid()::text,
  name                   text not null check (length(trim(name)) >= 3),
  email                  text not null,
  password_hash          text not null,
  role                   text not null
                         check (role in ('Administrador', 'Coordinador', 'Profesional', 'Recepción', 'Voluntario')),
  department             text not null default 'General',
  active                 boolean not null default true,
  failed_login_attempts  integer not null default 0,
  locked_until           timestamptz,           -- bloqueo tras 5 intentos fallidos
  last_login_at          timestamptz,
  created_at             timestamptz not null default now(),
  updated_at             timestamptz not null default now()
);

create unique index users_email_unique on public.users (lower(email));

create trigger users_updated_at
  before update on public.users
  for each row execute function public.set_updated_at();

-- -----------------------------------------------------------------------------
-- RNF-02  Sesiones JWT (máx. 30 min, inactividad 15 min, logout revoca)
--   POST /auth/login   -> insert (expires_at = now() + 30 min)
--   POST /auth/refresh -> update expires_at, refreshed_at, refresh_count + 1
--   POST /auth/logout  -> update revoked_at = now()
-- -----------------------------------------------------------------------------
create table public.sessions (
  id                text primary key default gen_random_uuid()::text,  -- usar como "jti" del JWT
  user_id           text not null references public.users (id) on delete cascade,
  created_at        timestamptz not null default now(),
  expires_at        timestamptz not null,
  last_activity_at  timestamptz not null default now(),
  refreshed_at      timestamptz,
  refresh_count     integer not null default 0,
  revoked_at        timestamptz,
  ip_address        text,
  user_agent        text
);

create index sessions_user_idx on public.sessions (user_id);
create index sessions_active_idx on public.sessions (expires_at) where revoked_at is null;

-- -----------------------------------------------------------------------------
-- RF-02 / RNF-06  Pacientes y anamnesis clínica
-- -----------------------------------------------------------------------------
create table public.patients (
  id                        text primary key default ('p-' || substr(md5(gen_random_uuid()::text), 1, 8)),
  name                      text not null check (length(trim(name)) >= 3),
  ci                        text not null unique,
  phone                     text not null,
  address                   text not null default 'La Paz, Bolivia',
  emergency_contact         text not null,
  caregiver_relation        text not null default 'Familiar / Cuidador',
  -- RNF-06 Consentimiento informado
  consent                   boolean not null default false,
  consent_date              date,
  access_status             text not null default 'Pendiente'
                            check (access_status in ('Activo', 'Pendiente', 'Revocado')),
  -- Anamnesis (ClinicalAnamnesis)
  diagnosis                 text not null default 'Enfermedad de Parkinson',
  stage                     text not null default 'Estadio I (Leve unilateral)'
                            check (stage in (
                              'Estadio I (Leve unilateral)',
                              'Estadio II (Bilateral sin alteración del equilibrio)',
                              'Estadio III (Moderado con inestabilidad postural)',
                              'Estadio IV (Incapacidad grave pero camina con ayuda)',
                              'Estadio V (Dependencia completa)',
                              'Otro trastorno del movimiento')),
  neurologist_certificate   boolean not null default false,
  symptom_notes             text not null default '',
  physical_evaluation       text not null default '',
  speech_evaluation         text not null default '',
  psychological_evaluation  text not null default '',
  medications               text not null default '',
  created_by                text references public.users (id) on delete set null,
  created_at                timestamptz not null default now(),
  updated_at                timestamptz not null default now(),
  -- RNF-06: sin consentimiento no puede haber acceso clínico activo
  constraint patients_activo_requiere_consentimiento
    check (access_status <> 'Activo' or consent)
);

create index patients_name_idx on public.patients (lower(name));
create index patients_access_idx on public.patients (access_status);

create trigger patients_updated_at
  before update on public.patients
  for each row execute function public.set_updated_at();

-- -----------------------------------------------------------------------------
-- RF-17  Bitácora de auditoría (solo inserción; no se edita ni se borra)
-- -----------------------------------------------------------------------------
create table public.audit_logs (
  id          text primary key default gen_random_uuid()::text,
  date        timestamptz not null default now(),
  actor       text not null,
  actor_role  text not null
              check (actor_role in ('Administrador', 'Coordinador', 'Profesional', 'Recepción', 'Voluntario', 'Sistema')),
  category    text not null
              check (category in ('AUTENTICACION', 'PACIENTES', 'CONSENTIMIENTO', 'USUARIOS_ROLES',
                                  'INVENTARIO', 'CRONOGRAMA', 'DONACIONES', 'SISTEMA')),
  severity    text not null check (severity in ('INFO', 'WARNING', 'CRITICAL')),
  action      text not null,
  detail      text not null,
  ip_address  text not null default '127.0.0.1'
);

create index audit_logs_date_idx on public.audit_logs (date desc);
create index audit_logs_filters_idx on public.audit_logs (category, severity);

-- La bitácora es inmutable: bloquea UPDATE y DELETE.
create or replace function public.audit_logs_inmutable()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  raise exception 'La bitácora de auditoría no se puede modificar ni eliminar (RF-17)';
end;
$$;

create trigger audit_logs_no_update_delete
  before update or delete on public.audit_logs
  for each row execute function public.audit_logs_inmutable();

-- -----------------------------------------------------------------------------
-- RF-04 / RF-10  Cronograma de actividades sabatinas
-- -----------------------------------------------------------------------------
create table public.schedules (
  id            text primary key default gen_random_uuid()::text,
  date          date not null,
  time          time not null,
  title         text not null,
  category      text not null
                check (category in ('Fisioterapia', 'Arteterapia', 'Fonoaudiología', 'Psicología', 'Bienestar')),
  professional  text not null,
  location      text not null,
  spots         integer not null default 0 check (spots >= 0),
  published     boolean not null default true,   -- visible en el portal público
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);

create index schedules_date_idx on public.schedules (date, time);

create trigger schedules_updated_at
  before update on public.schedules
  for each row execute function public.set_updated_at();

-- -----------------------------------------------------------------------------
-- RF-12 a RF-16  Asistencia a actividades
-- -----------------------------------------------------------------------------
create table public.attendance (
  id            text primary key default gen_random_uuid()::text,
  patient_id    text references public.patients (id) on delete set null,
  patient_name  text not null,
  schedule_id   text references public.schedules (id) on delete set null,
  date          date not null,
  time          time not null,
  activity      text not null,
  status        text not null default 'Pendiente'
                check (status in ('Pendiente', 'Presente', 'Ausente')),
  updated_at    timestamptz not null default now()
);

create index attendance_date_idx on public.attendance (date desc);
create index attendance_patient_idx on public.attendance (patient_id);
-- Un paciente se registra una sola vez por actividad.
create unique index attendance_unique_idx on public.attendance (patient_id, schedule_id)
  where patient_id is not null and schedule_id is not null;

create trigger attendance_updated_at
  before update on public.attendance
  for each row execute function public.set_updated_at();

-- -----------------------------------------------------------------------------
-- RF-03 / RF-09  Inventario
-- -----------------------------------------------------------------------------
create table public.inventory_items (
  id          text primary key default gen_random_uuid()::text,
  code        text not null unique,
  name        text not null,
  category    text not null
              check (category in ('Fisioterapia', 'Mobiliario', 'Papelería', 'Ayuda Técnica')),
  quantity    integer not null check (quantity >= 0),
  origin      text not null
              check (origin in ('Propio ASPAR', 'Préstamo Alcaldía', 'Donación')),
  condition   text not null default 'Bueno'
              check (condition in ('Óptimo', 'Bueno', 'En mantenimiento', 'Baja')),
  location    text not null,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

create index inventory_items_origin_idx on public.inventory_items (origin);
create index inventory_items_condition_idx on public.inventory_items (condition);

create trigger inventory_items_updated_at
  before update on public.inventory_items
  for each row execute function public.set_updated_at();

-- -----------------------------------------------------------------------------
-- RF-05  Galería multimedia (archivos en Cloudinary / S3 / Supabase Storage)
-- -----------------------------------------------------------------------------
create table public.media_assets (
  id                text primary key default gen_random_uuid()::text,
  title             text not null,
  type              text not null check (type in ('Imagen', 'Video')),
  category          text not null default 'Actividades Sabatinas',
  storage_provider  text not null default 'Cloudinary / AWS S3',
  url               text not null,
  size_mb           numeric(10, 2) not null default 0 check (size_mb >= 0),
  uploaded_at       timestamptz not null default now(),
  uploaded_by       text references public.users (id) on delete set null
);

create index media_assets_uploaded_idx on public.media_assets (uploaded_at desc);

-- -----------------------------------------------------------------------------
-- RF-06  Donaciones
-- -----------------------------------------------------------------------------
create table public.donations (
  id          text primary key default gen_random_uuid()::text,
  donor_name  text not null default 'Donante Solidario',
  amount_bs   numeric(12, 2) not null check (amount_bs > 0),
  method      text not null
              check (method in ('QR Bancario', 'Pasarela Libélula', 'Transferencia Directa')),
  purpose     text not null default 'Fondo general de rehabilitación ASPAR',
  status      text not null default 'Pendiente' check (status in ('Verificado', 'Pendiente')),
  reference   text,                       -- nro. de transacción / comprobante
  date        date not null default current_date,
  created_at  timestamptz not null default now()
);

create index donations_date_idx on public.donations (date desc);

-- -----------------------------------------------------------------------------
-- RF-07 / RF-08 / RF-06  Contenido institucional (una sola fila)
-- -----------------------------------------------------------------------------
create table public.institutional_info (
  id                       smallint primary key default 1 check (id = 1),
  mission                  text not null default '',
  vision                   text not null default '',
  history_summary          text not null default '',
  inspiration_model        text not null default '',
  enrollment_requirements  text[] not null default '{}',
  facebook_url             text not null default '',
  instagram_url            text not null default '',
  tiktok_url               text not null default '',
  qr_image_url             text,             -- QR bancario oficial
  bank_name                text,
  bank_account             text,
  libelula_url             text,
  updated_at               timestamptz not null default now()
);

create trigger institutional_info_updated_at
  before update on public.institutional_info
  for each row execute function public.set_updated_at();

-- =============================================================================
-- SEGURIDAD
-- FastAPI se conecta con el usuario "postgres" (connection string), que no
-- está sujeto a RLS. Activamos RLS SIN políticas y quitamos permisos a los
-- roles de la API pública de Supabase (anon / authenticated): así nadie puede
-- leer pacientes ni usuarios usando la "anon key" de Supabase.
-- =============================================================================
do $$
declare
  t text;
begin
  foreach t in array array[
    'users', 'sessions', 'patients', 'audit_logs', 'schedules', 'attendance',
    'inventory_items', 'media_assets', 'donations', 'institutional_info'
  ] loop
    execute format('alter table public.%I enable row level security', t);
    if exists (select 1 from pg_roles where rolname = 'anon') then
      execute format('revoke all on public.%I from anon, authenticated', t);
    end if;
  end loop;
end;
$$;

-- =============================================================================
-- DATOS INICIALES
-- =============================================================================

insert into public.institutional_info (
  id, mission, vision, history_summary, inspiration_model, enrollment_requirements,
  facebook_url, instagram_url, tiktok_url
) values (
  1,
  'Brindar atención integral, rehabilitación física, fonoaudiológica, psicológica y acompañamiento humano a personas con la enfermedad de Parkinson y a sus familias en La Paz.',
  'Consolidar un Centro de Día y clínica abierta en Bolivia inspirado en el modelo de la Corporación CETRAM de Chile.',
  'La Asociación de Parkinson "Mario Lagrava" (ASPAR) articula especialistas, voluntarios y cuidadores en jornadas sabatinas de rehabilitación motora, cognitiva y emocional.',
  'Corporación CETRAM (Chile)',
  array[
    'Fotocopia de Cédula de Identidad del paciente y croquis/dirección de domicilio.',
    'Datos de contacto de un familiar directo o cuidador responsable.',
    'Diagnóstico neurológico de Parkinson u otro trastorno del movimiento (o valoración clínica inicial en ASPAR).',
    'Firma del consentimiento informado para el tratamiento confidencial de datos clínicos (RNF-06).'
  ],
  'https://www.facebook.com/aspar.bolivia',
  'https://www.instagram.com/aspar.bolivia',
  'https://www.tiktok.com/@aspar.bolivia'
);

-- Usuarios iniciales (mismos que el backend de demostración).
-- Contraseñas cifradas con bcrypt. ¡CÁMBIALAS antes de usar el sistema en serio!
insert into public.users (id, name, email, password_hash, role, department) values
  ('u-admin', 'Greta Torrez (Directora ASPAR)', 'admin@aspar.org',        extensions.crypt('Admin2026!',      extensions.gen_salt('bf', 12)), 'Administrador', 'Dirección Ejecutiva'),
  ('u-coord', 'Junior Quiroga',                 'coordinacion@aspar.org', extensions.crypt('Coord2026!',      extensions.gen_salt('bf', 12)), 'Coordinador',   'Coordinación General'),
  ('u-demo',  'Lic. Ana Flores',                'demo@aspar.org',         extensions.crypt('Aspar2026!',      extensions.gen_salt('bf', 12)), 'Profesional',   'Fisioterapia y Rehabilitación'),
  ('u-recep', 'Carla Mendoza',                  'recepcion@aspar.org',    extensions.crypt('Recep2026!',      extensions.gen_salt('bf', 12)), 'Recepción',     'Atención y Afiliaciones'),
  ('u-vol',   'Mateo Quispe',                   'voluntario@aspar.org',   extensions.crypt('Voluntario2026!', extensions.gen_salt('bf', 12)), 'Voluntario',    'Apoyo Sabatino'),
  ('u-dayana', 'Dayana Gretel Rojas Valencia',  'dayana.rojas@ucb.edu.bo',     extensions.crypt('Admin123', extensions.gen_salt('bf', 12)), 'Administrador', 'Soluna Solutions - Arquitectura y Backend'),
  ('u-jose',   'José Fabián Rodríguez Porco',   'jose.rodriguez.p@ucb.edu.bo', extensions.crypt('Admin123', extensions.gen_salt('bf', 12)), 'Administrador', 'Soluna Solutions - Dirección de Proyecto');

-- -----------------------------------------------------------------------------
-- DATOS DE DEMOSTRACIÓN (los mismos que muestra hoy el frontend).
-- Puedes borrar esta sección si no los quieres.
-- -----------------------------------------------------------------------------
insert into public.patients (
  id, name, ci, phone, address, emergency_contact, caregiver_relation, consent, consent_date,
  access_status, diagnosis, stage, neurologist_certificate, symptom_notes, physical_evaluation,
  speech_evaluation, psychological_evaluation, medications
) values
  ('p-1', 'Elena Rojas', '1234567', '70000001', 'Av. Arce #2140, Sopocachi, La Paz',
   'Carlos Rojas (71522334)', 'Hijo / Cuidador principal', true, '2026-08-15', 'Activo',
   'Enfermedad de Parkinson idiopática', 'Estadio II (Bilateral sin alteración del equilibrio)', true,
   'Temblor en reposo en miembro superior derecho y bradicinesia leve.',
   'Marcha independiente con reducción de braceo; equilibrio conservado.',
   'Hipofonía leve; articulación comprensible, requiere ejercicios de proyección vocal.',
   'Ánimo estable, alta adherencia a talleres grupales sabatinos.',
   'Levodopa/Carbidopa 250/25 mg cada 8 horas'),
  ('p-2', 'Miguel Fernández', '7654321', '70000002', 'Calle 15 de Calacoto #450, La Paz',
   'Lucía Fernández (70688912)', 'Esposa / Familiar directo', false, null, 'Pendiente',
   'Parkinsonismo en evaluación clínica', 'Estadio I (Leve unilateral)', false,
   'Rigidez matutina leve validada por observación de síntomas en admisión.',
   'Rango articular funcional; pendiente completar batería de equilibrio.',
   'Sin disfagia; fluidez verbal normal.',
   'Ansiedad leve ante diagnóstico reciente; se sugiere acompañamiento.',
   'En ajuste por neurología');

insert into public.schedules (id, date, time, title, category, professional, location, spots) values
  ('s-1', current_date + 1, '09:00', 'Terapia física grupal y equilibrio',            'Fisioterapia',   'Lic. Ana Flores',      'Sala de rehabilitación ASPAR', 18),
  ('s-2', current_date + 2, '10:30', 'Taller de arteterapia y estimulación cognitiva', 'Arteterapia',    'Lic. Marco Rojas',     'Salón principal',              20),
  ('s-3', current_date + 4, '09:30', 'Fonoaudiología y proyección de la voz',          'Fonoaudiología', 'Lic. Valeria Camacho', 'Consultorio 2',                12);

insert into public.inventory_items (id, code, name, category, quantity, origin, condition, location) values
  ('inv-1', 'ASP-MAT-001', 'Colchonetas de rehabilitación de alta densidad', 'Fisioterapia',  14, 'Préstamo Alcaldía', 'Óptimo', 'Sala de rehabilitación'),
  ('inv-2', 'ASP-MAT-002', 'Balones terapéuticos Bobath (65 cm)',            'Fisioterapia',   8, 'Donación',          'Bueno',  'Depósito de fisioterapia'),
  ('inv-3', 'ASP-AYU-003', 'Bastones de apoyo de cuatro puntas',             'Ayuda Técnica', 10, 'Propio ASPAR',      'Óptimo', 'Recepción / Préstamo a pacientes');

insert into public.donations (id, donor_name, amount_bs, method, purpose, status, date) values
  ('don-1', 'Aporte Solidario Anónimo', 350, 'QR Bancario',       'Compra de mats de yoga y balones de fisioterapia', 'Verificado', '2026-08-19'),
  ('don-2', 'Familia Viscarra',         500, 'Pasarela Libélula', 'Fondo pro-espacio propio de rehabilitación ASPAR', 'Verificado', '2026-08-23');
