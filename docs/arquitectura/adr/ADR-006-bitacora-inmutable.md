# ADR-006: Bitácora de auditoría inmutable y escrita solo por el Backend

- **Estado:** Aceptada
- **Fecha:** 2026-10-26
- **Requisitos:** RF-17

## Contexto

La bitácora debe servir como prueba de quién hizo qué. En la primera versión también se escribía desde el Frontend (`localStorage`), donde cualquier usuario puede alterarla.

## Decisión

- `services/audit_service.record` es el **único punto de escritura** de `audit_logs`.
- Un **trigger** (`audit_logs_no_update_delete`) rechaza cualquier `UPDATE` o `DELETE` sobre la tabla, incluso desde el editor SQL.
- La API solo expone `GET /audit`, restringido al rol `Administrador`; los intentos de otros roles quedan registrados.
- El actor se guarda por correo para conservar el historial aunque se elimine el usuario.

## Alternativas descartadas

- **Cadena de hashes por registro:** detecta alteraciones, pero el trigger ya impide modificarlos dentro de la base. Se puede agregar si se exige una verificación externa.

## Consecuencias

- ✅ Ni la API ni un administrador de la base pueden editar o borrar eventos.
- ⚠️ El Frontend todavía guarda eventos locales cuando trabaja sin API (ADR-008). Con la API disponible, la pantalla muestra la bitácora del servidor.

## Evidencia

`Backend/migrations/001_initial_schema.sql` (función `audit_logs_inmutable`), `Backend/tests/test_audit.py` (`test_la_bitacora_no_se_puede_modificar_ni_borrar`).
