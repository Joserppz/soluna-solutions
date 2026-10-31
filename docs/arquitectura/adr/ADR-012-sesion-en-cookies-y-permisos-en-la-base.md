# ADR-012: Sesión en cookies HttpOnly con CSRF y permisos por rol en la base

- **Estado:** Aceptada
- **Fecha:** 2026-10-31
- **Reemplaza a:** [ADR-003](./ADR-003-jwt-con-sesiones-en-servidor.md)
- **Requisitos:** RF-01, RF-11, RNF-02, RNF-06

## Contexto

En el Sprint 1 el login devolvía el JWT en el cuerpo y el frontend lo guardaba en `localStorage` para enviarlo como `Authorization: Bearer`. Cualquier script inyectado en la página (XSS) podía leerlo. Además, los permisos estaban escritos en el código como listas de roles (`require_roles("Administrador", ...)`): cambiar quién puede hacer qué exigía un despliegue.

## Decisión

- **Token solo en cookie.** El login guarda el JWT en la cookie `aspar_session` (`HttpOnly`, `Secure`, `SameSite=Lax`, `Path=/api`). JavaScript nunca lo ve. El JWT lleva solo `sub`, `sid`, `iat` y `exp`. La sesión sigue en la tabla `sessions` (revocación, 15 minutos de inactividad y tope de 8 horas), como en ADR-003.
- **CSRF con double-submit firmado.** El token CSRF es un HMAC del id de la sesión. Llega en el cuerpo de cada respuesta de sesión (`csrfToken`) y en la cookie legible `aspar_csrf`. El frontend lo repite en `X-CSRF-Token` en todo `POST/PUT/PATCH/DELETE`. Además, `OriginCheckMiddleware` rechaza las escrituras que vienen de un `Origin` fuera de `CORS_ORIGINS`.
- **Cookies propias de cada API.** En producción y en staging `COOKIE_DOMAIN` queda vacío: la cookie es solo del host de su API. Así la sesión de producción nunca viaja a `api.staging.aspar.com`. `aspar.com` y `api.aspar.com` son el mismo *sitio*, por lo que `SameSite=Lax` igual envía la cookie.
- **Permisos en la base.** `roles`, `permissions` (17 claves fijas) y `role_permissions`. Cada endpoint exige claves con `require_permission(...)`. El rol del sistema `admin` siempre tiene todas y la base impide quitárselas. La regla de consentimiento (RNF-06) se aplica siempre, además del permiso.
- **Contrato.** Las claves se publican en OpenAPI como enumeración (`PermissionKey`). La sesión solo publica claves conocidas, así un permiso nuevo en la base no rompe el inicio de sesión.

## Alternativas

- *Token en `localStorage` con `Authorization: Bearer`*: expuesto a XSS. Descartada.
- *`COOKIE_DOMAIN=.aspar.com`*: la cookie de producción llegaría a cualquier subdominio, incluido staging. Descartada.
- *Permisos como listas de roles en el código*: cada cambio exige desplegar. Descartada.

## Consecuencias

- ✅ Un XSS ya no puede robar la sesión. El cierre de sesión y la inactividad se siguen controlando en el servidor.
- ✅ Administración podrá cambiar los permisos de cada rol desde el panel sin tocar código.
- ⚠️ El frontend y la API deben compartir sitio (`aspar.com` / `api.aspar.com`). Un dominio distinto exigiría `SameSite=None`.
- ⚠️ Las vistas del Sprint 1 todavía usan el login antiguo. Se migran a la capa `src/api/` ([ADR-013](./ADR-013-contrato-openapi-y-capa-src-api.md)).

## Evidencia

`Backend/app/modules/auth/{cookies,dependencies,service}.py`, `Backend/app/core/middleware.py`, `Backend/migrations/001_base.sql` (roles y permisos), `Backend/tests/test_sessions.py`, `test_permissions.py`, `test_hardening.py`.
