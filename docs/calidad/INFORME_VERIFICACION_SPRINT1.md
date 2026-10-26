# Informe de Verificación del Sprint 1

Registro de las subtareas de verificación del Sprint 1: qué se probó, con qué prueba y con qué resultado. Las pruebas automáticas se ejecutan en el CI de cada push (`.github/workflows/`). El recorrido integrado está en [`docs/evidencias/RECORRIDO_INTEGRADO_LOGIN_PACIENTES.md`](../evidencias/RECORRIDO_INTEGRADO_LOGIN_PACIENTES.md).

**Ejecución de referencia:** rama `Sprint1` con los cambios de verificación, PostgreSQL 16 recién migrado, Python 3.12+ y Node.js 22.

| Origen | Archivo de pruebas | Ubicación |
| :--- | :--- | :--- |
| Backend (pytest) | `test_*.py` | `Backend/tests/` |
| Frontend (Vitest) | `*.spec.ts` | `Frontend/src/views/__test__/` |
| Recorrido E2E (Playwright) | `recorrido-integrado.cjs` | `Frontend/e2e/` |

**Resultado:** ✅ aprobado · ❌ falla · ⚠️ aprobado con observación

## SCRUM-28 — Probar el flujo de inicio de sesión (SCRUM-11 · RF-01)

| Caso | Prueba | Resultado |
| :--- | :--- | :--- |
| Login correcto devuelve token, sesión y datos del usuario | `test_auth_login.py::test_login_correcto_devuelve_token_y_usuario`, E2E paso 1 | ✅ |
| El correo se acepta sin distinguir mayúsculas | `test_auth_credentials.py::test_correo_en_mayusculas_inicia_sesion` | ✅ |
| Contraseña incorrecta y correo inexistente dan el mismo 401 genérico | `test_contrasena_incorrecta_es_401_con_mensaje_generico`, `test_correo_inexistente_responde_igual_que_contrasena_incorrecta`, E2E paso 7 | ✅ |
| Un usuario inactivo no inicia sesión | `test_usuario_inactivo_no_puede_iniciar_sesion` | ✅ |
| Formato de correo inválido o campos faltantes dan 422 con mensaje en texto | `test_formato_de_correo_invalido_es_422_con_mensaje_en_texto`, `test_campos_faltantes_es_422` | ✅ |
| 5 intentos fallidos bloquean la cuenta 15 min (423) y el bloqueo vence | `test_cinco_intentos_fallidos_bloquean_la_cuenta`, `test_bloqueo_vencido_permite_iniciar_sesion_y_reinicia_contador` | ✅ |
| La pantalla valida formulario vacío, formato de correo y mínimo de 8 caracteres | `LoginView.spec.ts` (2 casos) | ✅ |
| Un intento fallido deja un solo registro en la bitácora | `LoginView.spec.ts::registra un solo evento…`, `test_login_registra_auditoria` | ✅ |
| Con la cuenta bloqueada por el servidor, la pantalla no abre sesión local | `LoginView.spec.ts::si la API bloquea la cuenta (423)…`, E2E paso 8 | ✅ (defecto encontrado y corregido en SCRUM-88) |

**Conclusión:** el flujo de inicio de sesión cumple RF-01 en la API y en la pantalla.
