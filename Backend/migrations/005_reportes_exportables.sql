-- =============================================================================
-- ASPAR — Migración 005: reportes descargables por rol (evaluación de los Sprints 1 y 2)
--
-- Cada pantalla permite filtrar por rango de fechas y descargar en CSV o Excel el
-- resultado completo del filtro. Descargar saca datos del sistema, por eso además del
-- permiso de la pantalla hace falta «reports:export», que Administración asigna por rol.
-- Administración (rol del sistema) lo tiene siempre.
-- =============================================================================

insert into public.permissions (key, description, is_sensitive) values
  ('reports:export', 'Descargar en CSV o Excel el resultado completo de un filtro', true)
on conflict (key) do nothing;

-- Coordinación y Recepción ya preparan informes; Profesional y Voluntariado no descargan
insert into public.role_permissions (role_id, permission_key)
select r.id, 'reports:export'
from public.roles r
where r.key in ('admin', 'coordination', 'reception')
on conflict do nothing;
