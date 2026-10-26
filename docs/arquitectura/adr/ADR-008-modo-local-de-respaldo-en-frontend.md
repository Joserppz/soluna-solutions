# ADR-008: Modo local de respaldo en el Frontend, solo si la API no responde

- **Estado:** Aceptada (temporal, revisar en el Sprint 2)
- **Fecha:** 2026-10-26
- **Requisitos:** RF-01, RF-02

## Contexto

El Frontend se desarrolló antes que la API. Para poder demostrar y probar las pantallas, guarda datos de ejemplo en `localStorage` y tiene contraseñas de demostración. El recorrido integrado (SCRUM-88) mostró que ese respaldo se activaba también cuando la API **sí** respondía: con una cuenta bloqueada (423), el Frontend abría una sesión local.

## Decisión

- El modo local solo se usa cuando la API **no responde** (error de red). Si la API responde con un error (401, 422, 423…), su decisión es la final (`ApiError` en `services/api.ts`).
- Cada sesión indica su origen (`source: 'api' | 'local'`). Una sesión de la API solo se renueva con `POST /auth/refresh`.
- Las cuentas de demostración solo se muestran en modo desarrollo.

## Consecuencias

- ✅ El Frontend se puede usar sin Backend durante el desarrollo, sin saltarse las decisiones del servidor.
- ⚠️ Inventario, asistencia, cronograma, galería y donaciones todavía funcionan **solo** en modo local hasta que existan sus endpoints (Sprint 2).
- ⏳ Cuando la API esté desplegada, se debe retirar el modo local del login para producción.

## Evidencia

`Frontend/src/services/api.ts`, `Frontend/src/services/aspar.ts` (`signInWithApi`), `Frontend/src/views/__test__/LoginView.spec.ts`, `docs/evidencias/RECORRIDO_INTEGRADO_LOGIN_PACIENTES.md` (§4).
