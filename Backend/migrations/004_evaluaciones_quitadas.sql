-- =============================================================================
-- ASPAR — Migración 004: una evaluación registrada por error se puede quitar
--
-- Quitar una evaluación (por ejemplo, la que se cargó en la ficha de otra persona)
-- es una baja lógica: deja de mostrarse, pero se conserva con quién la quitó,
-- cuándo y por qué. Los datos clínicos no se borran (RNF-06, nada se borra).
-- =============================================================================

alter table public.patient_evaluations
  add column removed_at timestamptz,
  add column removed_by uuid references public.users (id) on delete set null,
  add column removal_reason text;

-- Una evaluación quitada siempre dice cuándo y por qué; una vigente no tiene motivo
alter table public.patient_evaluations
  add constraint patient_evaluations_quitada_con_motivo check (
    (removed_at is null and removal_reason is null)
    or (removed_at is not null and length(trim(removal_reason)) >= 3)
  );

create index patient_evaluations_vigentes
  on public.patient_evaluations (patient_id, evaluated_on desc)
  where removed_at is null;
