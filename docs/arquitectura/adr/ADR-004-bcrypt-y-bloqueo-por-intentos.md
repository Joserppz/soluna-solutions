# ADR-004: Contraseñas con bcrypt y bloqueo tras 5 intentos

- **Estado:** Aceptada
- **Fecha:** 2026-10-26
- **Requisitos:** RF-01, RNF-02 (el SRS exige bcrypt)

## Contexto

La primera versión guardaba SHA-256 con una sal fija, lo que no cumple el SRS y permite ataques por diccionario.

## Decisión

- Contraseñas con **bcrypt, costo 12** (`core/security.py`); las semillas de la migración usan `crypt(..., gen_salt('bf', 12))`.
- **Bloqueo en el servidor:** 5 intentos fallidos bloquean la cuenta **15 minutos** (`users.failed_login_attempts`, `users.locked_until`), con respuesta **423** y registro en la bitácora.
- El mensaje de error del login no distingue entre correo inexistente y contraseña incorrecta.

## Alternativas descartadas

- **Argon2:** más moderno, pero el SRS pide bcrypt explícitamente.
- **Solo bloqueo en el Frontend (30 s):** se puede saltar llamando a la API directamente.

## Consecuencias

- ✅ Cumple el SRS y resiste fuerza bruta.
- ⚠️ El Frontend mantiene su propio bloqueo de 30 s; manda el del servidor. Desde la corrección de SCRUM-88, el Frontend ya no abre una sesión local cuando la API responde 423.

## Evidencia

`Backend/app/services/auth_service.py`, `Backend/tests/test_auth_credentials.py`, `Backend/tests/test_security.py`.
