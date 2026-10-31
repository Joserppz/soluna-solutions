-- =============================================================================
-- ASPAR — Migración 002: búsqueda rápida por fragmentos de texto (pg_trgm)
--
-- Los buscadores del panel filtran con ILIKE '%texto%' (afiliados por nombre o CI,
-- equipo por nombre o correo, bitácora por actor). Un índice B-tree común no sirve
-- para un comodín al inicio; los índices GIN de trigramas sí, y se mantienen rápidos
-- aunque la bitácora crezca a cientos de miles de filas.
--
-- La extensión va en el esquema "extensions" (convención de Supabase), fuera de public.
-- =============================================================================

create schema if not exists extensions;
create extension if not exists pg_trgm with schema extensions;

-- La clase de operadores se resuelve con la ruta de búsqueda: así funciona también si
-- pg_trgm ya estaba instalada en otro esquema. SET LOCAL dura solo esta transacción.
set local search_path = public, extensions;

create index patients_name_trgm on public.patients using gin (name gin_trgm_ops);
create index patients_ci_trgm on public.patients using gin (ci gin_trgm_ops);

create index users_name_trgm on public.users using gin (name gin_trgm_ops);
create index users_email_trgm on public.users using gin (email gin_trgm_ops);

create index audit_logs_actor_trgm on public.audit_logs using gin (actor gin_trgm_ops);
