# ADR-008: Modo local de respaldo en el Frontend, solo si la API no responde

- **Estado:** Retirada en el Sprint 2 (bloques F5b y F6). Se conserva como registro de la decisión.
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

## Retiro (Sprint 2)

Con la API completa, cada pantalla pasó a `src/api/` ([ADR-013](./ADR-013-contrato-openapi-y-capa-src-api.md)) y el modo local dejó de tener sentido:

- **F5b:** la portada nueva reemplazó a la última pantalla que usaba el servicio del modo demo. Se borraron `src/services/aspar.ts`, `src/services/api.ts`, `src/types/aspar.ts`, `legacy.css` y su prueba (`PantallasRequisitos.spec.ts`).
- **F6:** la bandeja de solicitudes reemplazó a la última sección «en preparación». Se borraron `SectionPreparingView.vue` y la variable `VITE_DEMO_MODE`.

Hoy no hay cuentas de demostración en el Frontend ni datos del sistema guardados en el navegador. Si la API no responde, la pantalla lo dice («No pudimos…», «Intentar de nuevo») y no inventa datos. Lo único que queda en `localStorage` es la hora del último uso, que `useIdleSession` comparte entre pestañas para el aviso de inactividad (RNF-02): no es un dato del sistema.

`Frontend/src/__test__/sinModoDemo.spec.ts` comprueba que cada sección tiene su vista conectada a la API y que ningún archivo vuelve a usar el servicio del modo demo, `VITE_DEMO_MODE` ni el almacenamiento del navegador.

Las cuentas de demostración siguen existiendo, pero en la base, creadas por `python -m scripts.seed_demo` (Backend), y la API decide como con cualquier otra cuenta.
