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

## SCRUM-30 — Probar la protección de endpoints (SCRUM-12 · RNF-02)

| Caso | Prueba | Resultado |
| :--- | :--- | :--- |
| Sin token, los endpoints protegidos responden 401 | `test_auth_login.py::test_verify_sin_token_es_401`, `test_patients_api.py::test_listar_pacientes_requiere_sesion` | ✅ |
| Un token alterado o mal formado es rechazado | `test_security.py::test_token_alterado_es_rechazado`, `test_sessions.py::test_token_mal_formado_es_rechazado` | ✅ |
| Un token vencido es rechazado | `test_security.py::test_token_expirado_es_rechazado`, `test_sessions.py::test_sesion_vencida_por_tiempo_maximo_es_rechazada` | ✅ |
| 15 min de inactividad cierran y revocan la sesión | `test_sessions.py::test_sesion_inactiva_15_minutos_expira_y_se_revoca` | ✅ |
| Cada petición válida renueva la última actividad | `test_peticion_autenticada_actualiza_la_ultima_actividad` | ✅ |
| `POST /auth/refresh` extiende la sesión con un token nuevo | `test_refresh_extiende_la_sesion_y_entrega_token_nuevo` | ✅ |
| Tras el logout, el mismo token ya no sirve | `test_logout_revoca_la_sesion`, E2E paso 9 | ✅ |
| Un token con la sesión de otro usuario es rechazado | `test_token_con_sesion_de_otro_usuario_es_rechazado` | ✅ |
| Los roles sin permiso reciben 403 y el intento queda en la bitácora | `test_users_api.py::test_solo_administrador_gestiona_usuarios`, `test_audit.py::test_solo_administrador_consulta_y_el_intento_queda_registrado` | ✅ |
| Los errores siempre devuelven `detail` como texto | `test_contract_frontend.py::test_errores_devuelven_detail_como_texto` | ✅ |

**Conclusión:** ningún endpoint protegido responde sin una sesión válida y activa.

## SCRUM-69 — Validar registro, consulta y reglas de pacientes (SCRUM-13 · RF-02)

| Caso | Prueba | Resultado |
| :--- | :--- | :--- |
| Alta de paciente con el formato que espera el Frontend (201) | `test_patients_api.py::test_crear_paciente_devuelve_201_con_formato_del_frontend`, E2E paso 3 | ✅ |
| Listado, búsqueda por nombre o CI y consulta por id | `test_listar_y_buscar_pacientes`, `test_consultar_paciente_por_id`, `test_patient_model.py::test_busqueda_por_nombre_y_ci`, E2E paso 2 | ✅ |
| La CI duplicada se rechaza (409) en la API y en la base | `test_ci_duplicada_es_409`, `test_patient_model.py::test_ci_duplicada_es_rechazada`, E2E paso 4 | ✅ |
| Validaciones de nombre, CI, teléfono y contacto con los mismos mensajes del Frontend | `test_validaciones_con_los_mismos_mensajes_del_frontend`, `PatientsView.spec.ts::muestra el error de validación…` | ✅ |
| Sin consentimiento no se activa el acceso; la base también lo impide | `test_no_se_activa_sin_consentimiento`, `test_acceso_activo_sin_consentimiento_es_rechazado_por_la_base`, `PantallasRequisitos.spec.ts::rechaza activar el acceso…` | ✅ |
| El estadio de Hoehn y Yahr debe ser válido | `test_estadio_desconocido_es_rechazado` | ✅ |
| Actualización parcial de la ficha y fecha de consentimiento | `test_actualizar_parcialmente_la_ficha`, `test_otorgar_consentimiento_registra_la_fecha` | ✅ |
| El Voluntario no registra ni edita; solo el Administrador elimina | `test_voluntario_no_puede_registrar_ni_editar`, `test_solo_administrador_elimina_fichas` | ✅ |
| Formulario y listado en pantalla | `PatientsView.spec.ts` (3 casos), `PantallasRequisitos.spec.ts::guarda la ficha válida…` | ⚠️ La pantalla no permite editar los datos personales (la API sí) |

**Conclusión:** las reglas de pacientes se cumplen en la base, en la API y en la pantalla. Queda pendiente la pantalla de edición (Sprint 2).
