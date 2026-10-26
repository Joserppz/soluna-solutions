# ADR-007: Supabase accesible solo desde el Backend

- **Estado:** Aceptada
- **Fecha:** 2026-10-26
- **Requisitos:** RNF-06, diagrama C2

## Contexto

Supabase publica una API REST automática sobre cada tabla, accesible con la `anon key`. Si el Frontend la usara, las reglas de RNF-06 y RF-17 se podrían saltar.

## Decisión

- El Frontend **solo** habla con la API FastAPI; nunca con Supabase.
- Todas las tablas tienen **Row Level Security activado sin políticas** y se revocan los permisos de `anon` y `authenticated`. La API REST pública de Supabase no devuelve datos.
- El Backend se conecta con la cadena de conexión de PostgreSQL y usa la `service_role key` solo para Storage. Ambas viven en el `.env` del Backend.

## Consecuencias

- ✅ Una sola puerta de entrada a los datos, con permisos y auditoría.
- ⚠️ No se pueden usar funciones de Supabase pensadas para el cliente (Auth, Realtime) sin revisar esta decisión.

## Evidencia

`Backend/migrations/001_initial_schema.sql` (bloque de RLS), `Backend/migrations/002_patient_documents.sql`, `Backend/app/core/config.py`.
