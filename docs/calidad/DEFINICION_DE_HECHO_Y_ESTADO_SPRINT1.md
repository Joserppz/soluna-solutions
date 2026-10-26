# Definición de Hecho (DoD), Aceptación y Estado Real del Sprint 1 (SCRUM-57 / SCRUM-83)

Este documento fija la **Definición de Hecho** del proyecto, la contrasta con lo entregado en `Sprint1` y deja registrado el **estado real** del sprint: lo terminado, lo terminado con observaciones y lo que pasa al Sprint 2.

## 1. Definición de Hecho (DoD)

Una **subtarea** está hecha cuando cumple todo lo siguiente:

| # | Criterio | Cómo se comprueba |
| :--- | :--- | :--- |
| D1 | El cambio está en la rama de su historia (`SCRUM-XX`) con commit `tipo(SCRUM-XX/SCRUM-YY): …` | Historial de Git ([convención](../git/FLUJO_GIT_Y_PULL_REQUESTS.md#5-convención-de-git-del-proyecto-scrum-65--scrum-109)) |
| D2 | Se integró a `SprintN` mediante un Pull Request con la plantilla completa | PR en GitHub |
| D3 | Los pipelines de Frontend y Backend están en verde: lint, formato, tipos, pruebas y build | GitHub Actions |
| D4 | El código nuevo tiene pruebas automáticas y la cobertura no baja del 70% (RNF-05) | Resumen de cobertura del CI |
| D5 | Si toca datos de pacientes, respeta RNF-06; si es una operación sensible, queda en la bitácora (RF-17) | Pruebas de privacidad y de bitácora |
| D6 | La documentación afectada está actualizada (README, contrato API, OpenAPI, matriz de trazabilidad) | Revisión del PR; `test_openapi.py` |
| D7 | Hay evidencia del criterio de aceptación (prueba, captura o recorrido) en `docs/` | Carpetas `docs/evidencias/` y `docs/calidad/` |

Una **historia** está hecha cuando todas sus subtareas (Frontend, Backend y verificación) están hechas y su criterio de aceptación se demuestra **de punta a punta**, desde la pantalla hasta la base de datos.

## 2. Verificación del DoD por historia y tarea

**Estado:** ✅ hecho · ⚠️ hecho con observaciones · ❌ no cumple

| Historia / Tarea | D1 | D2 | D3 | D4 | D5 | D6 | D7 | Estado real | Observación |
| :--- | :---: | :---: | :---: | :---: | :---: | :---: | :---: | :--- | :--- |
| SCRUM-11 RF-01 Inicio de sesión | ✅ | ⚠️ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ Hecho | Defecto de sesión local con cuenta bloqueada, encontrado y corregido en SCRUM-88 |
| SCRUM-12 RNF-02 Sesiones y tokens | ✅ | ⚠️ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ Hecho | `App.vue` (contador y banner) no tiene prueba de componente |
| SCRUM-13 RF-02 Pacientes y anamnesis | ✅ | ⚠️ | ✅ | ✅ | ✅ | ✅ | ✅ | ⚠️ Con observaciones | No hay pantalla para **editar** la ficha (la API sí lo permite) |
| SCRUM-123 RNF-06 Datos de pacientes | ✅ | ⚠️ | ✅ | ✅ | ✅ | ✅ | ✅ | ⚠️ Con observaciones | La pantalla muestra los campos clínicos a Recepción (el servidor los rechaza) |
| SCRUM-128 RNF-11 Estándares | ✅ | ⚠️ | ✅ | ✅ | — | ✅ | ✅ | ✅ Hecho | — |
| SCRUM-129 RF-11 Usuarios y roles | ✅ | ⚠️ | ✅ | ✅ | ✅ | ✅ | ✅ | ⚠️ Con observaciones | La pantalla no muestra la contraseña temporal que devuelve la API |
| SCRUM-135 RF-17 Bitácora | ✅ | ⚠️ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ Hecho | — |
| SCRUM-57 Aceptación y evidencias | ✅ | ⚠️ | ✅ | — | — | ✅ | ⚠️ | ⚠️ Con observaciones | Faltan las 4 capturas del proyecto Supabase real (§7 de `EVIDENCIAS_BACKEND_SPRINT1.md`) |
| SCRUM-58 Integración login y pacientes | ✅ | ⚠️ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ Hecho | Recorrido integrado 9/9 |
| SCRUM-59 README y `.env.example` | ✅ | ⚠️ | ✅ | — | — | ✅ | ✅ | ✅ Hecho | — |
| SCRUM-61 CI/CD | ✅ | ⚠️ | ✅ | ✅ | — | ✅ | ✅ | ✅ Hecho | — |
| SCRUM-64 C4, datos y migraciones | ✅ | ⚠️ | ✅ | ✅ | ✅ | ✅ | ✅ | ⚠️ Con observaciones | ADR y diagramas pendientes de revisión de la arquitecta; imágenes `C2.jpeg` / `C3.jpeg` sin actualizar |
| SCRUM-65 Flujo de Git | ✅ | ⚠️ | ✅ | — | — | ✅ | ✅ | ✅ Hecho | — |
| SCRUM-136 Trazabilidad | ✅ | ⚠️ | ✅ | — | — | ✅ | ✅ | ⚠️ Con observaciones | RF-12 a RF-16 sin definición en el SRS |
| SCRUM-190 BPMN 2.0 | ✅ | ⚠️ | ✅ | — | — | ✅ | ✅ | ✅ Hecho | — |
| SCRUM-191 Wireframes | ✅ | ⚠️ | ✅ | ✅ | — | ✅ | ✅ | ⚠️ Con observaciones | 2 bloques no cumplen (carga de galería pública y cronograma sin edición); pasan al Sprint 2 |

**Sobre D2:** las subtareas de Frontend llegaron a `Sprint1` sin PR y las de Backend en un único PR (#4) sin descripción ni plantilla. Las de verificación entran con el PR de este cambio. Queda como observación de proceso para el Sprint 2 ([observaciones del flujo Git](../git/FLUJO_GIT_Y_PULL_REQUESTS.md#61-observaciones)).

## 3. Estado real medido

| Indicador | Valor | Fuente |
| :--- | :--- | :--- |
| Pruebas automáticas del Backend | **99** aprobadas | pytest sobre PostgreSQL 16 |
| Pruebas automáticas del Frontend | **38** aprobadas | Vitest |
| Cobertura del Backend | **96,94%** | `pytest --cov` |
| Cobertura del Frontend | **80,30%** de líneas | `vitest --coverage` |
| Recorrido integrado (Frontend + API + PostgreSQL) | **9 de 9** pasos | `Frontend/e2e/recorrido-integrado.cjs` |
| Pipelines sobre `Sprint1` | ✅ verdes (#8 Backend, #25 Frontend) | GitHub Actions |
| Subtareas con commit enlazado | **50 de 50** | [Tabla de trazabilidad Git](../git/FLUJO_GIT_Y_PULL_REQUESTS.md#6-verificación-de-la-trazabilidad-jira--git-del-sprint-1-scrum-65--scrum-109) |
| Requisitos del Sprint 1 cubiertos de punta a punta | RF-01, RF-02, RF-11, RF-17, RNF-02, RNF-06 | [Matriz integral](../trazabilidad/MATRIZ_RF01_RF17.md) |

## 4. Pendientes registrados

### 4.1 Del Sprint 1 (corregir antes de cerrar el sprint o al inicio del Sprint 2)

| # | Pendiente | Historia | Responsable | Prioridad |
| :--- | :--- | :--- | :--- | :--- |
| P1 | Mostrar una vez la contraseña temporal al crear un usuario | SCRUM-129 / SCRUM-161 | Frontend | Alta |
| P2 | Ocultar o deshabilitar las evaluaciones clínicas para Recepción | SCRUM-123 / SCRUM-138 | Frontend | Alta |
| P3 | Cambiar en Supabase de producción las contraseñas sembradas por la migración 001 (`Admin123` y las de demostración) | SCRUM-64 | Backend / Dirección | Alta |
| P4 | Tomar las 4 capturas del proyecto Supabase real | SCRUM-57 / SCRUM-84 | Backend | Media |
| P5 | Revisar los ADR y los diagramas C4 actualizados | SCRUM-64 / SCRUM-106 | Arquitectura | Media |
| P6 | Abrir el PR de cierre `Sprint1` → `main` con la plantilla | SCRUM-65 | Dirección | Media |
| P7 | Transcribir RF-12 a RF-16 y RNF-07 a RNF-10 desde Jira a la adenda del SRS | SCRUM-136 | Dirección | Media |
| P8 | Ajustar el aviso 🔒 para que indique el motivo real (rol o consentimiento) | SCRUM-123 | Frontend | Baja |
| P9 | Prueba de componente para `App.vue` | SCRUM-12 | Frontend | Baja |

### 4.2 Alcance que pasa al Sprint 2

| Requisito | Pendiente |
| :--- | :--- |
| RF-02 | Pantalla de edición de la ficha del paciente |
| RF-03 / RF-09 | Endpoints de inventario, «dar de baja» y generación real del acta PDF |
| RF-04 / RF-10 | Edición y publicación del cronograma por el administrador, con Backend |
| RF-05 | Galería conectada a Supabase Storage y carga solo para el personal autenticado |
| RF-06 | Integración real con la pasarela Libélula y registro de donaciones en el Backend |
| RF-07 / RF-08 | Edición del contenido institucional |
| RF-12 a RF-16 | Endpoints de asistencia con la regla RNF-06 en el servidor |
| RNF-01, RNF-03, RNF-04 | Definir el hosting, prueba de carga y auditoría de accesibilidad WCAG 2.1 AA |

## 5. Resultado de la revisión de aceptación

**Sprint 1: aceptado con observaciones.**

Las historias del alcance del Sprint 1 (RF-01, RNF-02, RF-02, RNF-06, RF-11, RF-17 y RNF-11) funcionan de punta a punta, con pruebas automáticas, cobertura sobre el mínimo y evidencia registrada. Las observaciones P1 y P2 afectan a pantallas ya entregadas y deben corregirse primero. P3 es una condición de seguridad que debe cumplirse **antes** de usar el sistema con datos reales.

| Documento relacionado | Contenido |
| :--- | :--- |
| [`INFORME_VERIFICACION_SPRINT1.md`](./INFORME_VERIFICACION_SPRINT1.md) | Casos probados por subtarea de verificación |
| [`../evidencias/RECORRIDO_INTEGRADO_LOGIN_PACIENTES.md`](../evidencias/RECORRIDO_INTEGRADO_LOGIN_PACIENTES.md) | Recorrido de punta a punta con capturas |
| [`../evidencias/EVIDENCIAS_CI_Y_COBERTURA_SPRINT1.md`](../evidencias/EVIDENCIAS_CI_Y_COBERTURA_SPRINT1.md) | CI y cobertura real |
| [`../evidencias/EVIDENCIAS_SPRINT1.md`](../evidencias/EVIDENCIAS_SPRINT1.md) y [`EVIDENCIAS_BACKEND_SPRINT1.md`](../evidencias/EVIDENCIAS_BACKEND_SPRINT1.md) | Evidencias visuales del Frontend y del Backend |
