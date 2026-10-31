# ADR-013: Contrato único OpenAPI → TypeScript y capa de datos `src/api/`

- **Estado:** Aceptada
- **Fecha:** 2026-10-31
- **Reemplaza a:** [ADR-009](./ADR-009-contrato-verificado-por-prueba.md)
- **Requisitos:** RNF-11

## Contexto

ADR-009 verificaba el contrato con una prueba que leía `Frontend/src/types/aspar.ts` con expresiones regulares. Seguían existiendo dos definiciones de cada DTO, escritas a mano, y la prueba solo cubría algunos endpoints. Con el Sprint 2 la API cambió (cookies, `/auth/me`, listados paginados, bajas con motivo) y el frontend necesita una capa de datos nueva.

## Decisión

- **Una sola fuente.** El Backend exporta `docs/api/openapi.json` (`python -m scripts.export_openapi`). El frontend genera `src/api/schema.d.ts` con `openapi-typescript` (`npm run api:types`). Nadie escribe a mano un tipo de la API.
- **Verificación en el CI.** `tests/test_openapi.py` falla si `openapi.json` no coincide con el código. `npm run api:types:check` falla si `schema.d.ts` no coincide con `openapi.json`. `npm run build` falla si una vista usa un campo que ya no existe.
- **Capa `Frontend/src/api/`.**
  - `HttpClient` envía siempre las cookies (`credentials: 'include'`) y el `X-CSRF-Token`, y convierte todo error en `ApiError` con el mensaje de la API.
  - `endpoints.ts` tiene un método por endpoint.
  - `session.ts` guarda el estado de sesión y los permisos (`can('patients:read')`).
- **Migración gradual.** La capa nueva convive con `src/services/` y el modo demo ([ADR-008](./ADR-008-modo-local-de-respaldo-en-frontend.md)) hasta que cada vista se migre. Así el CI y sus pruebas siguen en verde durante el cambio.

## Alternativas

- *Mantener la prueba de ADR-009*: dos fuentes de verdad y una cobertura parcial. Descartada.
- *Cliente generado completo (`openapi-fetch`, Orval)*: agrega una dependencia en tiempo de ejecución. Además, el manejo de CSRF, sesión vencida y mensajes de error igual hay que escribirlo. Descartada por ahora; los tipos generados permiten adoptarla después sin cambiar las vistas.

## Consecuencias

- ✅ Un cambio en la API que rompe al frontend aparece como error de TypeScript en el CI, no en la pantalla.
- ✅ Las claves de permisos están tipadas: `can('patients:raed')` no compila.
- ⚠️ Cada cambio de endpoint lleva dos archivos generados en el mismo commit (`openapi.json` y `schema.d.ts`).
- ⚠️ Mientras dure la migración conviven dos clientes HTTP. El de `src/services/` se elimina junto con el modo demo.

## Evidencia

`Frontend/scripts/api-types.mjs`, `Frontend/src/api/`, `Frontend/src/api/__test__/`, `Backend/tests/test_openapi.py`, `.github/workflows/ci-frontend.yml`.
