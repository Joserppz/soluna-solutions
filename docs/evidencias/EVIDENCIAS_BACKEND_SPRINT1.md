# Evidencias de API, Persistencia y Seguridad del Backend — Sprint 1 (SCRUM-57 / SCRUM-84)

Evidencias generadas **ejecutando** el Backend FastAPI (`Backend/`) contra PostgreSQL 16 con las migraciones `001` y `002` (el mismo esquema que Supabase). Las respuestas se capturaron con el cliente HTTP de FastAPI; los tokens y contraseñas temporales se recortaron.

Complementa el acta visual del frontend en [`EVIDENCIAS_SPRINT1.md`](./EVIDENCIAS_SPRINT1.md).

## 1. Resumen de criterios verificados

| Subtarea | Historia / Tarea | Criterio | Evidencia | Resultado |
| :--- | :--- | :--- | :--- | :--- |
| SCRUM-26 | SCRUM-11 (RF-01) | Login con bcrypt y emisión de JWT | §3.1, `test_auth_login.py` | **Cumple** |
| SCRUM-27 | SCRUM-11 (RF-01) | Mensajes 401/422/423 y bloqueo tras 5 intentos | §3.1, `test_auth_credentials.py` | **Cumple** |
| SCRUM-29 | SCRUM-12 (RNF-02) | 30 min máximo, 15 min de inactividad, refresh y logout | §3.4, §4, `test_sessions.py` | **Cumple** |
| SCRUM-31 / SCRUM-32 | SCRUM-13 (RF-02) | Ficha y anamnesis persistidas con validaciones | §3.2, §4, `test_patients_api.py` | **Cumple** |
| SCRUM-137 | SCRUM-123 (RNF-06) | Anamnesis solo para personal clínico con consentimiento; documentos privados | §3.2, `test_patient_privacy.py` | **Cumple** |
| SCRUM-160 | SCRUM-129 (RF-11) | Usuarios y roles solo para Administrador | §3.3, `test_users_api.py` | **Cumple** |
| SCRUM-178 | SCRUM-135 (RF-17) | Bitácora desde servicios e inmutable | §3.3, §5, `test_audit.py` | **Cumple** |
| SCRUM-152 / SCRUM-95 | SCRUM-128 / SCRUM-61 | Ruff, pytest y migraciones en CI | §2, §6 | **Cumple** |

## 2. Migraciones versionadas

```text
$ python -m scripts.migrate
$ python -m scripts.migrate --status
Migraciones aplicadas: 001_initial_schema.sql, 002_patient_documents.sql
[aplicada ] 001_initial_schema.sql
[aplicada ] 002_patient_documents.sql
```

## 3. Recorrido de la API

### 3.1 Autenticación (RF-01)
#### Salud de la API y conexión a PostgreSQL
`GET /api/v1/health` → **200**

```json
{
  "status": "ok",
  "service": "ASPAR API",
  "database": "postgresql"
}
```

#### Login correcto (correo en mayúsculas)
`POST /api/v1/auth/login` → **200**

```json
{
  "access_token": "eyJhbGciOiJIUzI1NiIsInR5…(JWT)",
  "token_type": "bearer",
  "expires_in": 1800,
  "idle_timeout": 900,
  "user": {
    "id": "u-dayana",
    "name": "Dayana Gretel Rojas Valencia",
    "email": "dayana.rojas@ucb.edu.bo",
    "role": "Administrador",
    "department": "Soluna Solutions - Arquitectura y Backend",
    "active": true
  }
}
```

#### Login con contraseña incorrecta
`POST /api/v1/auth/login` → **401**

```json
{
  "detail": "Correo o contraseña incorrectos, o usuario inactivo."
}
```

#### Login con correo mal formado
`POST /api/v1/auth/login` → **422**

```json
{
  "detail": "correo electrónico: ingresa un correo electrónico válido"
}
```

#### Petición sin token
`GET /api/v1/patients` → **401**

```json
{
  "detail": "Token Bearer requerido"
}
```

### 3.2 Pacientes y protección de datos clínicos (RF-02, RNF-06)

#### RNF-06: Administrador consulta ficha con consentimiento Activo
`GET /api/v1/patients/p-1` → **200**

```json
{
  "id": "p-1",
  "name": "Elena Rojas",
  "accessStatus": "Activo",
  "clinicalAccess": true,
  "anamnesis": {
    "diagnosis": "Enfermedad de Parkinson idiopática",
    "stage": "Estadio II (Bilateral sin alteración del equilibrio)",
    "neurologistCertificate": true,
    "symptomNotes": "Temblor en reposo en miembro superior derecho y bradicinesia leve.",
    "physicalEvaluation": "Marcha independiente con reducción de braceo; equilibrio conservado.",
    "speechEvaluation": "Hipofonía leve; articulación comprensible, requiere ejercicios de proyección vocal.",
    "psychologicalEvaluation": "Ánimo estable, alta adherencia a talleres grupales sabatinos.",
    "medications": "Levodopa/Carbidopa 250/25 mg cada 8 horas"
  }
}
```

#### RNF-06: Recepción consulta la misma ficha (anamnesis oculta)
`GET /api/v1/patients/p-1` → **200**

```json
{
  "id": "p-1",
  "name": "Elena Rojas",
  "accessStatus": "Activo",
  "clinicalAccess": false,
  "anamnesis": {
    "diagnosis": "",
    "stage": "",
    "neurologistCertificate": false,
    "symptomNotes": "",
    "physicalEvaluation": "",
    "speechEvaluation": "",
    "psychologicalEvaluation": "",
    "medications": ""
  }
}
```

#### RNF-06: activar paciente sin consentimiento
`POST /api/v1/patients` → **422**

```json
{
  "detail": "No se puede activar el acceso clínico sin consentimiento informado firmado (RNF-06)."
}
```

#### Recepción registra una ficha nueva (persistida en PostgreSQL)
`POST /api/v1/patients` → **201**

```json
{
  "id": "p-fef60a8a",
  "name": "Rosa Mamani",
  "ci": "4455667-LP",
  "consent": true,
  "consentDate": "2026-10-26",
  "accessStatus": "Activo",
  "clinicalAccess": false
}
```

#### CI duplicada
`POST /api/v1/patients` → **409**

```json
{
  "detail": "Ya existe un paciente registrado con esa Cédula de Identidad."
}
```

#### Recepción intenta registrar medicación
`PATCH /api/v1/patients/p-1` → **403**

```json
{
  "detail": "Solo el personal clínico (Administrador, Coordinador, Profesional) puede registrar síntomas, evaluaciones y medicación (RNF-06)."
}
```

### 3.3 Roles y bitácora (RF-11, RF-17)

#### Recepción intenta ver usuarios
`GET /api/v1/users` → **403**

```json
{
  "detail": "El rol Recepción no tiene permisos para esta operación."
}
```

#### Administrador crea un usuario (contraseña temporal)
`POST /api/v1/users` → **201**

```json
{
  "id": "u-c9450ca7",
  "name": "Lic. Paola Vargas",
  "email": "paola.vargas@aspar.org",
  "role": "Profesional",
  "active": true,
  "department": "Fonoaudiología",
  "createdAt": "2026-10-26T17:26:25.640215+00:00",
  "temporaryPassword": "Aspar-…"
}
```

#### RF-17: bitácora filtrada por severidad WARNING
`GET /api/v1/audit?severity=WARNING` → **200**

```json
[
  {
    "actor": "dayana.rojas@ucb.edu.bo",
    "actorRole": "Administrador",
    "category": "USUARIOS_ROLES",
    "action": "Creación de usuario",
    "detail": "Creó paola.vargas@aspar.org con rol Profesional (Fonoaudiología)",
    "ipAddress": "192.168.1.20"
  },
  {
    "actor": "recepcion@aspar.org",
    "actorRole": "Recepción",
    "category": "SISTEMA",
    "action": "Intento de acceso restringido bloqueado",
    "detail": "El rol Recepción intentó GET /api/v1/users (permitido para: Administrador)",
    "ipAddress": "192.168.1.20"
  },
  {
    "actor": "recepcion@aspar.org",
    "actorRole": "Recepción",
    "category": "PACIENTES",
    "action": "Intento de registrar datos clínicos sin permiso",
    "detail": "El rol Recepción intentó editar evaluaciones clínicas",
    "ipAddress": "192.168.1.20"
  },
  {
    "actor": "jose.rodriguez.p@ucb.edu.bo",
    "actorRole": "Sistema",
    "category": "AUTENTICACION",
    "action": "Intento fallido de inicio de sesión",
    "detail": "Credenciales inválidas o cuenta inactiva para jose.rodriguez.p@ucb.edu.bo",
    "ipAddress": "192.168.1.20"
  }
]
```

### 3.4 Cierre de sesión (RNF-02)

#### Cierre de sesión
`POST /api/v1/auth/logout` → **200**

```json
{
  "message": "Sesión cerrada correctamente"
}
```

#### Token usado después del logout
`GET /api/v1/auth/verify` → **401**

```json
{
  "detail": "Sesión inválida o expirada. Inicia sesión nuevamente."
}
```


## 4. Persistencia en PostgreSQL tras el recorrido

Sesiones registradas (la del Administrador quedó revocada por el logout) y la ficha creada por Recepción con su fecha de consentimiento:

```text
                  id                  | user_id  | refresh_count | revocada |  ip_address  
--------------------------------------+----------+---------------+----------+--------------
 0a1bec96-8b73-4a2b-b6b1-2a19d2d96438 | u-dayana |             0 | t        | 192.168.1.20
 d6cc721c-952c-4a7e-bba7-0a63b6f9294c | u-recep  |             0 | f        | 192.168.1.20
(2 rows)

     id     |       name       |     ci     | consent | consent_date | access_status 
------------+------------------+------------+---------+--------------+---------------
 p-1        | Elena Rojas      | 1234567    | t       | 2026-08-15   | Activo
 p-2        | Miguel Fernández | 7654321    | f       |              | Pendiente
 p-fef60a8a | Rosa Mamani      | 4455667-LP | t       | 2026-10-26   | Activo
(3 rows)
```

## 5. Seguridad de la bitácora (RF-17)

Intento directo en la base de datos de modificar la bitácora:

```text
postgres=# update audit_logs set detail = 'x';
ERROR:  La bitácora de auditoría no se puede modificar ni eliminar (RF-17)
CONTEXT:  PL/pgSQL function public.audit_logs_inmutable() line 3 at RAISE
```

## 6. Calidad de código y pruebas automáticas

```text
$ ruff check . && ruff format --check .
All checks passed!
58 files already formatted
```

**pytest:** `97 passed in 37.96s`

| Archivo | Pruebas | Qué verifica |
| :--- | :---: | :--- |
| `test_audit.py` | 7 | Bitácora RF-17: consulta, filtros, accesos bloqueados, inmutabilidad |
| `test_auth_credentials.py` | 9 | Validación de credenciales, mensajes y bloqueo por intentos |
| `test_auth_login.py` | 4 | Login JWT, sesión creada y auditoría |
| `test_contract_frontend.py` | 6 | Contrato contra Frontend/src/types/aspar.ts |
| `test_health.py` | 1 | Conexión de la API con PostgreSQL |
| `test_migrations.py` | 4 | Migraciones versionadas y baseline |
| `test_patient_model.py` | 10 | Modelo de pacientes y restricciones de la base |
| `test_patient_privacy.py` | 17 | RNF-06: anamnesis por rol/consentimiento y documentos privados |
| `test_patients_api.py` | 13 | CRUD y validaciones de pacientes |
| `test_security.py` | 5 | bcrypt (incluye hashes de pgcrypto) y JWT |
| `test_sessions.py` | 7 | Expiración, inactividad, refresh y logout |
| `test_storage_adapter.py` | 3 | Adaptador de Supabase Storage |
| `test_users_api.py` | 11 | Usuarios y roles RF-11 |

<details>
<summary>Detalle de las pruebas ejecutadas</summary>

```text
tests/test_audit.py::test_consultar_bitacora_con_formato_del_frontend  ✅
tests/test_audit.py::test_filtros_por_categoria_severidad_y_actor  ✅
tests/test_audit.py::test_filtro_invalido_es_422  ✅
tests/test_audit.py::test_solo_administrador_consulta_y_el_intento_queda_registrado  ✅
tests/test_audit.py::test_operaciones_sensibles_quedan_en_la_bitacora  ✅
tests/test_audit.py::test_la_bitacora_no_se_puede_modificar_ni_borrar  ✅
tests/test_audit.py::test_categoria_desconocida_es_rechazada_en_el_servicio  ✅
tests/test_auth_credentials.py::test_login_request_normaliza_el_correo  ✅
tests/test_auth_credentials.py::TestValidacionDeCredenciales::test_correo_en_mayusculas_inicia_sesion  ✅
tests/test_auth_credentials.py::TestValidacionDeCredenciales::test_contrasena_incorrecta_es_401_con_mensaje_generico  ✅
tests/test_auth_credentials.py::TestValidacionDeCredenciales::test_correo_inexistente_responde_igual_que_contrasena_incorrecta  ✅
tests/test_auth_credentials.py::TestValidacionDeCredenciales::test_usuario_inactivo_no_puede_iniciar_sesion  ✅
tests/test_auth_credentials.py::TestValidacionDeCredenciales::test_formato_de_correo_invalido_es_422_con_mensaje_en_texto  ✅
tests/test_auth_credentials.py::TestValidacionDeCredenciales::test_campos_faltantes_es_422  ✅
tests/test_auth_credentials.py::TestValidacionDeCredenciales::test_cinco_intentos_fallidos_bloquean_la_cuenta  ✅
tests/test_auth_credentials.py::TestValidacionDeCredenciales::test_bloqueo_vencido_permite_iniciar_sesion_y_reinicia_contador  ✅
tests/test_auth_login.py::test_login_correcto_devuelve_token_y_usuario  ✅
tests/test_auth_login.py::test_login_registra_auditoria  ✅
tests/test_auth_login.py::test_verify_con_token_valido  ✅
tests/test_auth_login.py::test_verify_sin_token_es_401  ✅
tests/test_contract_frontend.py::test_se_leen_las_interfaces_del_frontend  ✅
tests/test_contract_frontend.py::TestContratoLoginYPacientes::test_login_cumple_login_response_dto  ✅
tests/test_contract_frontend.py::TestContratoLoginYPacientes::test_refresh_cumple_refresh_response_dto  ✅
tests/test_contract_frontend.py::TestContratoLoginYPacientes::test_pacientes_cumplen_patient_y_clinical_anamnesis  ✅
tests/test_contract_frontend.py::TestContratoLoginYPacientes::test_usuarios_y_bitacora_cumplen_user_y_audit_event  ✅
tests/test_contract_frontend.py::TestContratoLoginYPacientes::test_errores_devuelven_detail_como_texto  ✅
tests/test_health.py::test_health_conecta_con_postgresql  ✅
tests/test_migrations.py::test_migraciones_numeradas_y_en_orden  ✅
tests/test_migrations.py::test_migraciones_crean_las_tablas_del_modelo  ✅
tests/test_migrations.py::test_reaplicar_migraciones_no_hace_nada  ✅
tests/test_migrations.py::test_base_creada_a_mano_exige_baseline  ✅
tests/test_patient_model.py::test_salida_usa_camel_case_igual_que_el_frontend  ✅
tests/test_patient_model.py::test_sin_consentimiento_la_fecha_sale_vacia  ✅
tests/test_patient_model.py::test_sin_acceso_clinico_la_anamnesis_sale_vacia  ✅
tests/test_patient_model.py::test_entrada_acepta_camel_case_y_fecha_vacia  ✅
tests/test_patient_model.py::test_constantes_coinciden_con_el_frontend  ✅
tests/test_patient_model.py::TestRestriccionesDeLaTabla::test_guarda_y_lee_un_paciente  ✅
tests/test_patient_model.py::TestRestriccionesDeLaTabla::test_ci_duplicada_es_rechazada  ✅
tests/test_patient_model.py::TestRestriccionesDeLaTabla::test_acceso_activo_sin_consentimiento_es_rechazado_por_la_base  ✅
tests/test_patient_model.py::TestRestriccionesDeLaTabla::test_estadio_desconocido_es_rechazado  ✅
tests/test_patient_model.py::TestRestriccionesDeLaTabla::test_busqueda_por_nombre_y_ci  ✅
tests/test_patient_privacy.py::TestAnamnesis::test_personal_clinico_ve_la_anamnesis_con_consentimiento_activo  ✅
tests/test_patient_privacy.py::TestAnamnesis::test_recepcion_y_voluntario_no_ven_la_anamnesis  ✅
tests/test_patient_privacy.py::TestAnamnesis::test_sin_consentimiento_nadie_ve_la_anamnesis  ✅
tests/test_patient_privacy.py::TestAnamnesis::test_listado_tambien_oculta_la_anamnesis  ✅
tests/test_patient_privacy.py::TestAnamnesis::test_consulta_de_ficha_clinica_queda_auditada  ✅
tests/test_patient_privacy.py::TestAnamnesis::test_recepcion_registra_filiacion_con_datos_de_admision  ✅
tests/test_patient_privacy.py::TestAnamnesis::test_recepcion_no_registra_evaluaciones_clinicas  ✅
tests/test_patient_privacy.py::TestAnamnesis::test_recepcion_puede_actualizar_consentimiento  ✅
tests/test_patient_privacy.py::TestDocumentosPrivados::test_subir_listar_y_obtener_enlace_temporal  ✅
tests/test_patient_privacy.py::TestDocumentosPrivados::test_roles_no_clinicos_no_listan_ni_descargan  ✅
tests/test_patient_privacy.py::TestDocumentosPrivados::test_voluntario_no_sube_documentos  ✅
tests/test_patient_privacy.py::TestDocumentosPrivados::test_rechaza_tipos_de_archivo_no_permitidos  ✅
tests/test_patient_privacy.py::TestDocumentosPrivados::test_rechaza_archivos_de_mas_de_10_mb  ✅
tests/test_patient_privacy.py::TestDocumentosPrivados::test_documento_de_otro_paciente_no_se_expone  ✅
tests/test_patient_privacy.py::TestDocumentosPrivados::test_falla_del_almacenamiento_no_guarda_metadata  ✅
tests/test_patient_privacy.py::TestDocumentosPrivados::test_solo_administrador_elimina_documentos  ✅
tests/test_patient_privacy.py::TestDocumentosPrivados::test_sin_configuracion_de_storage_responde_503  ✅
tests/test_patients_api.py::test_listar_pacientes_requiere_sesion  ✅
tests/test_patients_api.py::test_listar_y_buscar_pacientes  ✅
tests/test_patients_api.py::test_crear_paciente_devuelve_201_con_formato_del_frontend  ✅
tests/test_patients_api.py::test_consultar_paciente_por_id  ✅
tests/test_patients_api.py::test_ci_duplicada_es_409  ✅
tests/test_patients_api.py::test_validaciones_con_los_mismos_mensajes_del_frontend  ✅
tests/test_patients_api.py::test_no_se_activa_sin_consentimiento  ✅
tests/test_patients_api.py::test_sin_consentimiento_se_registra_pendiente_sin_fecha  ✅
tests/test_patients_api.py::test_actualizar_parcialmente_la_ficha  ✅
tests/test_patients_api.py::test_retirar_consentimiento_pasa_a_pendiente_y_audita_warning  ✅
tests/test_patients_api.py::test_otorgar_consentimiento_registra_la_fecha  ✅
tests/test_patients_api.py::test_voluntario_no_puede_registrar_ni_editar  ✅
tests/test_patients_api.py::test_solo_administrador_elimina_fichas  ✅
tests/test_security.py::test_bcrypt_verifica_la_contrasena_correcta  ✅
tests/test_security.py::test_bcrypt_acepta_hashes_generados_por_pgcrypto  ✅
tests/test_security.py::test_token_incluye_sesion_y_expira_en_milisegundos  ✅
tests/test_security.py::test_token_alterado_es_rechazado  ✅
tests/test_security.py::test_token_expirado_es_rechazado  ✅
tests/test_sessions.py::test_peticion_autenticada_actualiza_la_ultima_actividad  ✅
tests/test_sessions.py::test_sesion_inactiva_15_minutos_expira_y_se_revoca  ✅
tests/test_sessions.py::test_sesion_vencida_por_tiempo_maximo_es_rechazada  ✅
tests/test_sessions.py::test_refresh_extiende_la_sesion_y_entrega_token_nuevo  ✅
tests/test_sessions.py::test_logout_revoca_la_sesion  ✅
tests/test_sessions.py::test_token_con_sesion_de_otro_usuario_es_rechazado  ✅
tests/test_sessions.py::test_token_mal_formado_es_rechazado  ✅
tests/test_storage_adapter.py::test_upload_usa_bucket_privado_y_service_key  ✅
tests/test_storage_adapter.py::test_signed_url_devuelve_url_absoluta_con_expiracion  ✅
tests/test_storage_adapter.py::test_error_del_storage_se_propaga  ✅
tests/test_users_api.py::test_listar_usuarios_con_formato_del_frontend  ✅
tests/test_users_api.py::test_solo_administrador_gestiona_usuarios  ✅
tests/test_users_api.py::test_crear_usuario_con_contrasena_temporal_que_permite_iniciar_sesion  ✅
tests/test_users_api.py::test_crear_usuario_con_contrasena_propia  ✅
tests/test_users_api.py::test_validaciones_de_usuario  ✅
tests/test_users_api.py::test_cambiar_rol_cierra_las_sesiones_del_usuario  ✅
tests/test_users_api.py::test_desactivar_usuario_es_critico_y_bloquea_el_login  ✅
tests/test_users_api.py::test_administrador_no_puede_quitarse_su_propio_rol  ✅
tests/test_users_api.py::test_debe_quedar_al_menos_un_administrador  ✅
tests/test_users_api.py::test_restablecer_contrasena  ✅
tests/test_users_api.py::test_usuario_inexistente_es_404  ✅
```

</details>

## 7. Evidencias pendientes en el proyecto Supabase real

Las capturas siguientes las toma el equipo sobre el proyecto Supabase de producción:

1. **Table Editor** con las 11 tablas (`users`, `sessions`, `patients`, `patient_documents`, `audit_logs`, …) y `schema_migrations` con las versiones `001` y `002`.
2. **Storage** con el bucket `documentos-pacientes` marcado como **Private**.
3. **Swagger** (`http://localhost:8000/docs`) ejecutando `POST /api/v1/auth/login` con `dayana.rojas@ucb.edu.bo`.
4. Pestaña **Actions** de GitHub con el workflow `ci-backend.yml` en verde.
