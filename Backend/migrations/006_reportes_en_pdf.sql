-- =============================================================================
-- ASPAR — Migración 006: los reportes se descargan en Excel o en PDF
--
-- El CSV se reemplaza por PDF: Excel sigue para trabajar los datos y el PDF sirve para
-- imprimir o enviar el reporte tal cual. Solo cambia el texto del permiso que ve
-- Administración en «Qué puede ver cada rol»; quién lo tiene no cambia.
-- =============================================================================

update public.permissions
set description = 'Descargar en Excel o PDF el resultado completo de un filtro'
where key = 'reports:export';
