-- =============================================================================
-- Migración 002 (SCRUM-123 / SCRUM-137): documentos privados de pacientes
-- Fotocopias de CI, certificados neurológicos, evaluaciones y consentimientos.
-- Los archivos viven en un bucket PRIVADO de Supabase Storage; aquí solo se
-- guarda la metadata. El Backend entrega URLs firmadas de corta duración.
-- =============================================================================

create table public.patient_documents (
  id             text primary key default gen_random_uuid()::text,
  patient_id     text not null references public.patients (id) on delete cascade,
  document_type  text not null
                 check (document_type in ('CI', 'Certificado neurológico', 'Evaluación clínica',
                                          'Consentimiento informado', 'Otro')),
  file_name      text not null,
  storage_path   text not null unique,
  content_type   text not null
                 check (content_type in ('application/pdf', 'image/jpeg', 'image/png', 'image/webp')),
  size_bytes     integer not null check (size_bytes > 0 and size_bytes <= 10485760),
  uploaded_by    text references public.users (id) on delete set null,
  uploaded_at    timestamptz not null default now()
);

create index patient_documents_patient_idx on public.patient_documents (patient_id, uploaded_at desc);

alter table public.patient_documents enable row level security;

do $$
begin
  if exists (select 1 from pg_roles where rolname = 'anon') then
    revoke all on public.patient_documents from anon, authenticated;
  end if;
  -- Bucket privado (solo existe el esquema storage en Supabase)
  if exists (select 1 from information_schema.tables
             where table_schema = 'storage' and table_name = 'buckets') then
    insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
    values ('documentos-pacientes', 'documentos-pacientes', false, 10485760,
            array['application/pdf', 'image/jpeg', 'image/png', 'image/webp'])
    on conflict (id) do update set public = false;
  end if;
end;
$$;
