# Backlog de requisitos según ISO/IEC/IEEE 29148

ISO/IEC/IEEE 29148 pide que cada requisito tenga:

- un identificador único;
- su origen (fuente);
- una prioridad;
- su riesgo y su estabilidad;
- un método de verificación;
- trazabilidad hacia el diseño, el código y las pruebas.

Este documento reúne esos atributos para los 17 requisitos funcionales y los 11 no funcionales del proyecto.

**De dónde salen los datos**

- **Fuente, prioridad MoSCoW, riesgo, estabilidad y método de verificación:** el SRS v1.0 ([`DOCUMENTO_2.pdf`](./DOCUMENTO_2.pdf), secciones 1 a 3) y su [adenda](./SRS_ADENDA_SPRINT1.md).
- **Historia de Jira:** los mismos documentos y la [matriz de trazabilidad](../trazabilidad/MATRIZ_RF01_RF17.md).
- **Verificación real:** las pruebas automáticas del repositorio.

Donde el SRS no fija un atributo, la celda dice «Por confirmar en Jira» en lugar de suponerlo.

## 1. Requisitos funcionales

| ID | Historia Jira | Requisito («el sistema debe…») | Fuente | MoSCoW | Riesgo | Estabilidad | Verificación (SRS) | Verificación automática |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| RF-01 | SCRUM-11 | Permitir el inicio de sesión del personal con credenciales seguras (adenda: todo el personal, no solo administradores) | Equipo Dev. | Must | Alto | Alta | Demostración | `test_auth_login.py`, `test_accounts.py`, E2E `acceso.spec.ts` |
| RF-02 | SCRUM-13 | Registrar, editar y consultar datos personales, de contacto y diagnóstico de afiliados, familiares y cuidadores | ASPAR | Must | Alto | Media (pueden pedir nuevos campos) | Prueba / Demostración | `test_patients_api.py`, `tests/unit/test_reglas_afiliados.py`, E2E `afiliados.spec.ts` |
| RF-03 | SCRUM-136 | Registrar, clasificar y dar de baja material propio, donado o de la Alcaldía con cantidad, estado y origen | ASPAR | Must | Medio | Alta | Prueba | `test_inventory.py`, `tests/unit/test_reglas_inventario.py`, E2E `operacion.spec.ts` |
| RF-04 | SCRUM-16 | Publicar y actualizar el cronograma de actividades sabatinas | ASPAR / Equipo | Should | Medio | Alta | Demostración | `test_schedules.py`, `actividades.spec.ts` |
| RF-05 | SCRUM-136 | Subir fotos y videos a un almacenamiento independiente de Google Drive | ASPAR | Must | Alto (peso de la base) | Alta | Prueba / Análisis | `test_media.py`, `galeria.spec.ts` |
| RF-06 | SCRUM-136 | Mostrar en el sitio el QR bancario de la asociación para recibir aportes (sin pasarela, ver adenda) | Equipo Dev. | Should | Medio | Baja (depende del banco) | Prueba | `test_donations.py`, `tests/unit/test_reglas_donaciones.py`, E2E `apoyo.spec.ts` |
| RF-07 | SCRUM-136 | Editar la reseña histórica, el equipo y los requisitos de inscripción | ASPAR | Must | Bajo | Media | Demostración | `test_content.py`, `contenido.spec.ts` |
| RF-08 | SCRUM-136 | Enlazar desde el inicio a TikTok, Facebook e Instagram de ASPAR | Equipo Dev. | Could | Bajo | Alta | Inspección | `test_content.py`, E2E `sitio.spec.ts` |
| RF-09 | SCRUM-136 | Generar y exportar reportes de inventario en PDF o Excel para la Alcaldía (Sprint 3: en todas las pantallas) | ASPAR | Should | Medio | Alta | Prueba / Inspección | `test_reports.py`, `test_inventory.py`, E2E `reportes.spec.ts` |
| RF-10 | SCRUM-19 | Mostrar al público la última actividad cargada | Equipo Dev. | Must | Bajo | Alta | Inspección | `test_schedules.py`, `sitioPublico.spec.ts` |
| RF-11 | SCRUM-129 | Gestionar usuarios y asignarles un rol; desactivar cuentas y restablecer contraseñas | Equipo Dev. (adenda) | Must | Alto | Alta | Prueba | `test_users_api.py`, `test_roles.py`, `equipoPermisos.spec.ts` |
| RF-12 | SCRUM-130 | Tomar asistencia por actividad y resumirla por mes | ASPAR (adenda) | Por confirmar en Jira | Por confirmar en Jira | Alta | Prueba | `test_attendance.py`, `tests/unit/test_reglas_asistencia.py`, E2E `operacion.spec.ts` |
| RF-13 | SCRUM-131 | Registrar entradas, salidas e historial de cada material con cantidades transaccionales | ASPAR (adenda) | Por confirmar en Jira | Por confirmar en Jira | Alta | Prueba | `test_inventory.py`, `tests/unit/test_reglas_inventario.py` |
| RF-14 | SCRUM-132 | Registrar los aportes por canal y resumirlos por mes | ASPAR (adenda) | Por confirmar en Jira | Por confirmar en Jira | Media | Prueba | `test_donations.py`, `tests/unit/test_reglas_donaciones.py`, E2E `donaciones.spec.ts` |
| RF-15 | SCRUM-133 | Mostrar una meta pública con el total confirmado, sin datos de donantes | ASPAR (adenda) | Por confirmar en Jira | Por confirmar en Jira | Media | Prueba | `test_donations.py`, `apoyo.spec.ts` |
| RF-16 | SCRUM-134 | Recibir solicitudes de contacto y preinscripción y darles seguimiento | ASPAR (adenda) | Por confirmar en Jira | Por confirmar en Jira | Alta | Prueba | `test_inquiries.py`, E2E `solicitudes.spec.ts` |
| RF-17 | SCRUM-135 | Registrar las operaciones sensibles en una bitácora inmutable, visible solo para Administración | Equipo Dev. (adenda) | Must | Alto | Alta | Prueba | `test_audit.py`, `test_audit_activity.py`, E2E `registro-actividad.spec.ts` |

## 2. Requisitos no funcionales

| ID | Historia Jira | Requisito y métrica | MoSCoW | Riesgo | Verificación (SRS) | Verificación real |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| RNF-01 | — | La página pública carga en 3 s o menos con 50 usuarios a la vez | Must | Medio | Análisis (estrés, Lighthouse) | Se mide en el despliegue ([matriz, sección 5](../trazabilidad/MATRIZ_RF01_RF17.md#5-comprobaciones-manuales-en-staging)) |
| RNF-02 | SCRUM-12 | Contraseñas con bcrypt; sesión de 30 min como máximo y 15 min de inactividad; bloqueo tras 5 intentos | Must | Alto | Análisis (revisión de código) | `test_security.py`, `test_sessions.py`, `test_auth_credentials.py` |
| RNF-03 | — | WCAG 2.1 AA | Should | Medio | Inspección (herramientas de accesibilidad) | E2E `accesibilidad.spec.ts` (sin desplazamiento lateral de 360 a 1920 px, foco y etiquetas) |
| RNF-04 | — | Disponibilidad del 99,5 % mensual | Must | Bajo | Análisis (monitoreo) | Monitoreo cada 6 horas ([`disponibilidad.yml`](../../.github/workflows/disponibilidad.yml)); el porcentaje se mide en Cloud Run ([ADR-014](../arquitectura/adr/ADR-014-despliegue-y-operacion.md)) |
| RNF-05 | — | Cobertura de pruebas del 70 % o más | Could | Medio | Análisis (reporte de cobertura) | CI: Backend 98 %, Frontend 92 % ([evidencia](../evidencias/EVIDENCIAS_CI_Y_COBERTURA_SPRINT1.md)) |
| RNF-06 | SCRUM-123 | Datos clínicos solo para el personal clínico, con consentimiento firmado y acceso Activo | Must | Alto | Prueba | `test_patient_privacy.py`, `tests/unit/test_reglas_afiliados.py` |
| RNF-07 | SCRUM-124 | Respaldo automático fuera del servidor, con RPO y RTO medidos | Por confirmar en Jira | — | Prueba | `test_backup.py` |
| RNF-08 | SCRUM-125 | Chrome, Firefox, Edge y Safari, de 360 a 1920 px | Por confirmar en Jira | — | Inspección | E2E `accesibilidad.spec.ts`, `pantallas-completas.spec.ts` |
| RNF-09 | SCRUM-126 | Prueba de usabilidad con ASPAR y manual breve | Por confirmar en Jira | — | Demostración | [Manual del usuario](../manual/MANUAL_DE_USUARIO.md); la sesión de usabilidad, con personas de ASPAR |
| RNF-10 | SCRUM-127 | Consumo de Cloudinary controlado, con plan de contingencia | Por confirmar en Jira | — | Análisis | `test_media.py` (tamaños máximos) |
| RNF-11 | SCRUM-128 | Estándares automáticos y documentación: ESLint, Prettier, Ruff, migraciones y OpenAPI | Should | Bajo | Inspección | CI, `test_openapi.py`, `test_migrations.py` |

## 3. Cómo cumple cada atributo de ISO 29148

| Característica | Cómo se cumple en el proyecto |
| :--- | :--- |
| **Necesario** | Cada RF sale de la entrevista con ASPAR ([`DOCUMENTO_1.pdf`](../entrevistas/DOCUMENTO_1.pdf)) o de una decisión técnica registrada (adenda, ADR) |
| **No ambiguo y singular** | Un requisito por fila, con su métrica o criterio verificable en la adenda y en las historias de Jira |
| **Verificable** | Cada requisito tiene método de verificación y, salvo los que se miden en producción, una prueba automática que lo comprueba |
| **Factible y priorizado** | Prioridad MoSCoW y riesgo por requisito; el orden de los sprints siguió esa prioridad (los Must primero) |
| **Trazable** | Requisito → historia de Jira (`SCRUM-n`) → componente C4 y clase UML → módulo y endpoint → pruebas, en la [matriz de trazabilidad](../trazabilidad/MATRIZ_RF01_RF17.md) y en los commits (`tipo(SCRUM-n): …`) |
| **Gestión de cambios** | Los cambios al SRS v1.0 están en la [adenda](./SRS_ADENDA_SPRINT1.md) con su motivo (por ejemplo, RF-01 para todo el personal y RF-06 sin pasarela) |

## 4. Formato que debe tener cada historia en Jira

Este es el formato acordado para el tablero. Conviene revisarlo historia por historia antes de cada evaluación:

- **Enunciado:** «Como [rol] quiero [acción] para [beneficio]».
- **Criterios de aceptación:** «Dado / Cuando / Entonces», con la misma métrica de este documento.
- **Campos:** prioridad MoSCoW, fuente (ASPAR o Equipo), riesgo, story points, sprint y responsable.
- **Subtareas:** de Frontend (F), Backend (B) y verificación (V), las mismas de la columna «Subtareas F / B / V» de la matriz.
