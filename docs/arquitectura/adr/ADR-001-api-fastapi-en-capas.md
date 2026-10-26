# ADR-001: API FastAPI organizada en capas

- **Estado:** Aceptada
- **Fecha:** 2026-10-26
- **Requisitos:** RNF-11 (estándares de código), diagrama C3

## Contexto

La primera versión del Backend era un único `app/main.py` de más de 700 líneas con SQL escrito a mano sobre SQLite. El diagrama C3 (`modelos/c4/C3.jpeg`) ya proponía una API en capas con routers, services, repositories y adapters. Con más módulos en el Sprint 2 (inventario, cronograma, donaciones), el archivo único dificultaba probar y revisar los cambios.

## Decisión

Organizar `Backend/app/` según el C3:

| Capa | Carpeta | Responsabilidad |
| :--- | :--- | :--- |
| Routers | `app/routers/` | Endpoints HTTP, validación de entrada con esquemas y permisos por rol |
| Services | `app/services/` | Reglas de negocio (consentimiento, bloqueo, auditoría) |
| Repositories | `app/repositories/` | Acceso a datos con SQLAlchemy |
| Models / Schemas | `app/models/`, `app/schemas/` | Tablas ORM y contratos Pydantic de entrada y salida |
| Adapters | `app/adapters/` | Servicios externos (Supabase Storage) |
| Core | `app/core/` | Configuración, seguridad, dependencias y errores |

## Alternativas descartadas

- **Mantener el archivo único:** más simple al inicio, pero mezcla HTTP, reglas y SQL, y no permite probar los servicios por separado.
- **Estructura por módulo funcional** (`patients/router.py`, `patients/service.py`…): válida, pero se eligió la de capas para coincidir con el C3 ya aprobado.

## Consecuencias

- ✅ Cada regla de negocio tiene un único lugar y se prueba sin levantar HTTP.
- ✅ Los routers quedan delgados (todos al 100% de cobertura).
- ⚠️ Más archivos por funcionalidad; cada módulo nuevo del Sprint 2 debe seguir la misma estructura.

## Evidencia

`Backend/app/`, `Backend/tests/test_patients_api.py`, cobertura en `docs/evidencias/EVIDENCIAS_CI_Y_COBERTURA_SPRINT1.md`.
