# ADR-003: JWT HS256 respaldado por sesiones en la base de datos

- **Estado:** Reemplazada por [ADR-012](./ADR-012-sesion-en-cookies-y-permisos-en-la-base.md) (Sprint 2: el JWT viaja en una cookie HttpOnly con CSRF; las sesiones en la base se mantienen)
- **Fecha:** 2026-10-26
- **Requisitos:** RF-01, RNF-02 (30 min de sesión máxima, 15 min de inactividad, cierre de sesión)

## Contexto

Un JWT por sí solo no se puede invalidar antes de su vencimiento: un cierre de sesión solo borraría el token del navegador, y la inactividad de 15 minutos no se podría controlar en el servidor.

## Decisión

- Al iniciar sesión se crea una fila en `sessions` y se emite un **JWT HS256** con `sub` (usuario) y `sid` (id de la sesión).
- En cada petición, `core/deps.get_current_user` valida la firma del token **y** la fila de `sessions`: que no esté revocada, que no haya pasado `expires_at` (30 min) y que la última actividad sea de hace menos de 15 min. Cada petición válida actualiza `last_activity_at`.
- `POST /auth/refresh` extiende la misma sesión (`refresh_count`, `refreshed_at`) y `POST /auth/logout` la revoca (`revoked_at`).
- `iat` y `exp` van en **milisegundos**, porque el Frontend los compara con `Date.now()`.

## Alternativas descartadas

- **Solo JWT sin estado:** no permite logout real ni inactividad en el servidor.
- **Cookies de sesión del lado del servidor:** el Frontend ya usaba `Authorization: Bearer` y la SPA se sirve en otro origen.

## Consecuencias

- ✅ Un token cerrado o inactivo deja de servir de inmediato (verificado en el recorrido integrado, paso 9).
- ⚠️ Cada petición hace una lectura y una escritura en `sessions`.
- ⚠️ `exp` en milisegundos no sigue el estándar JWT (segundos). Si se integra otra librería cliente, habrá que documentarlo o migrar a segundos en ambos lados.

## Evidencia

`Backend/app/core/security.py`, `Backend/app/modules/auth/dependencies.py`, `Backend/tests/test_sessions.py`, `docs/evidencias/RECORRIDO_INTEGRADO_LOGIN_PACIENTES.md`.
