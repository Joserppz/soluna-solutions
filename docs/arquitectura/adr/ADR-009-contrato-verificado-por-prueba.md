# ADR-009: Contrato Frontend ↔ Backend verificado por una prueba automática

- **Estado:** Reemplazada por [ADR-013](./ADR-013-contrato-openapi-y-capa-src-api.md) (Sprint 2: los tipos del frontend se generan desde OpenAPI)
- **Fecha:** 2026-10-26
- **Requisitos:** RNF-11

## Contexto

Los tipos del Frontend (`Frontend/src/types/aspar.ts`) y las respuestas de la API se escribieron por separado. Un campo renombrado en un lado rompe la pantalla sin que falle ninguna prueba.

## Decisión

- `Backend/tests/test_contract_frontend.py` lee las interfaces TypeScript (`Patient`, `User`, `AuditEvent`, `LoginResponseDto`…) y comprueba que las respuestas reales de la API tengan todos sus campos obligatorios.
- El pipeline del Backend se ejecuta también cuando cambia `Frontend/src/types/**`.
- La especificación OpenAPI se exporta a `docs/api/openapi.json` y una prueba verifica que esté actualizada.

## Consecuencias

- ✅ Un cambio de contrato rompe el CI antes de llegar a la pantalla.
- ⚠️ La prueba lee TypeScript con expresiones regulares: solo admite interfaces simples (un campo por línea).

## Evidencia

`Backend/tests/test_contract_frontend.py`, `.github/workflows/ci-backend.yml` (filtro `paths`), `docs/api/CONTRATO_API_LOGIN_PACIENTES.md`.
