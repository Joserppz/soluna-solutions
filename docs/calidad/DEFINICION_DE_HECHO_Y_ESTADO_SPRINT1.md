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

**Estado:** ✅ hecho · ⚠️ hecho con observaciones · ❌ no cumple · ⏳ depende de una acción fuera del repositorio (§4.2)

| Historia / Tarea | D1 | D2 | D3 | D4 | D5 | D6 | D7 | Estado real | Observación |
| :--- | :---: | :---: | :---: | :---: | :---: | :---: | :---: | :--- | :--- |
| SCRUM-11 RF-01 Inicio de sesión | ✅ | ⏳ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ Hecho | Corregidos: sesión local con cuenta bloqueada (SCRUM-88) y login de demostración en producción (SCRUM-87) |
| SCRUM-12 RNF-02 Sesiones y tokens | ✅ | ⏳ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ Hecho | `App.vue` con prueba de componente (93% de cobertura) |
| SCRUM-13 RF-02 Pacientes y anamnesis | ✅ | ⏳ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ Hecho | Pantalla de edición de fichas agregada (registrar, **editar** y consultar) |
| SCRUM-123 RNF-06 Datos de pacientes | ✅ | ⏳ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ Hecho | Campos y acciones según el rol; aviso 🔒 con el motivo real |
| SCRUM-128 RNF-11 Estándares | ✅ | ⏳ | ✅ | ✅ | — | ✅ | ✅ | ✅ Hecho | — |
| SCRUM-129 RF-11 Usuarios y roles | ✅ | ⏳ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ Hecho | Contraseña temporal visible una vez y restablecimiento de contraseña |
| SCRUM-135 RF-17 Bitácora | ✅ | ⏳ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ Hecho | — |
| SCRUM-57 Aceptación y evidencias | ✅ | ⏳ | ✅ | — | — | ✅ | ⏳ | ✅ Hecho en el repositorio | Faltan las 4 capturas del proyecto Supabase real (acción A2) |
| SCRUM-58 Integración login y pacientes | ✅ | ⏳ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ Hecho | Recorrido integrado 11/11 |
| SCRUM-59 README y `.env.example` | ✅ | ⏳ | ✅ | — | — | ✅ | ✅ | ✅ Hecho | — |
| SCRUM-61 CI/CD | ✅ | ⏳ | ✅ | ✅ | — | ✅ | ✅ | ✅ Hecho | — |
| SCRUM-64 C4, datos y migraciones | ✅ | ⏳ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ Hecho en el repositorio | Script de rotación de contraseñas iniciales listo; ejecutarlo en Supabase (A1). Diagramas vigentes en Mermaid; revisión de la arquitecta (A3) |
| SCRUM-65 Flujo de Git | ✅ | ⏳ | ✅ | — | — | ✅ | ✅ | ✅ Hecho | — |
| SCRUM-136 Trazabilidad | ✅ | ⏳ | ✅ | — | — | ✅ | ✅ | ✅ Hecho | RF-12 a RF-16 y RNF-07 a RNF-10 registrados con su historia de Jira |
| SCRUM-190 BPMN 2.0 | ✅ | ⏳ | ✅ | — | — | ✅ | ✅ | ✅ Hecho | — |
| SCRUM-191 Wireframes | ✅ | ⏳ | ✅ | ✅ | — | ✅ | ✅ | ✅ Hecho | Los 12 bloques de requisitos del Sprint 1 cumplen; los 3 restantes son de historias de sprints siguientes (§4.4 de la revisión) |

**Sobre D2:** las subtareas de Frontend llegaron a `Sprint1` sin PR, las de Backend en un único PR (#4) sin plantilla y las de verificación y cierre directo a `Sprint1`. Todas quedan cubiertas por el **PR de cierre `Sprint1` → `main`** (acción A4); al fusionarlo, D2 pasa a ✅. Desde el Sprint 2 cada historia entra por su propio PR ([observaciones del flujo Git](../git/FLUJO_GIT_Y_PULL_REQUESTS.md#61-observaciones)).

## 3. Estado real medido (cierre del 28/10/2026)

| Indicador | Valor | Fuente |
| :--- | :--- | :--- |
| Pruebas automáticas del Backend | **103** aprobadas | pytest sobre PostgreSQL 16 |
| Pruebas automáticas del Frontend | **65** aprobadas | Vitest |
| Cobertura del Backend | **96,94%** | `pytest --cov` |
| Cobertura del Frontend | **89,26%** de líneas | `vitest --coverage` |
| Recorrido integrado (Frontend + API + PostgreSQL) | **11 de 11** pasos | `Frontend/e2e/recorrido-integrado.cjs` |
| Subtareas con commit enlazado | **50 de 50** | [Tabla de trazabilidad Git](../git/FLUJO_GIT_Y_PULL_REQUESTS.md#6-verificación-de-la-trazabilidad-jira--git-del-sprint-1-scrum-65--scrum-109) |
| Requisitos del Sprint 1 cubiertos de punta a punta | RF-01, RF-02, RF-11, RF-17, RNF-02, RNF-06 | [Matriz integral](../trazabilidad/MATRIZ_RF01_RF17.md) |

## 4. Pendientes

### 4.1 Pendientes del Sprint 1 y su resolución

| # | Pendiente | Historia | Resolución |
| :--- | :--- | :--- | :--- |
| P1 | Mostrar la contraseña temporal al crear un usuario | SCRUM-129 / SCRUM-161 | ✅ Se muestra una sola vez; también al restablecer una contraseña |
| P2 | Ocultar las evaluaciones clínicas a Recepción | SCRUM-123 / SCRUM-138 | ✅ Campos y acciones según el rol (también para el Voluntario) |
| P3 | Contraseñas sembradas por la migración 001 | SCRUM-64 / SCRUM-104 | ✅ en el repositorio: `scripts/rotar_contrasenas_iniciales.py` y el login de demostración queda desactivado en producción · ⏳ ejecutarlo en Supabase (A1) |
| P4 | 4 capturas del proyecto Supabase real | SCRUM-57 / SCRUM-84 | ⏳ Acción A2 |
| P5 | Revisión de los ADR y diagramas C4 | SCRUM-64 / SCRUM-106 | ⏳ Acción A3 |
| P6 | PR de cierre `Sprint1` → `main` | SCRUM-65 | ⏳ Acción A4 |
| P7 | RF-12 a RF-16 y RNF-07 a RNF-10 en la adenda | SCRUM-136 | ✅ Registrados (adenda §1.1) |
| P8 | Aviso 🔒 con el motivo real | SCRUM-123 / SCRUM-138 | ✅ Indica rol, consentimiento o estado de acceso |
| P9 | Prueba de componente de `App.vue` | SCRUM-12 / SCRUM-67 | ✅ 6 pruebas |
| P10 | Editar la ficha del paciente desde la pantalla | SCRUM-13 / SCRUM-68 | ✅ Botón «Editar ficha» con validaciones y reglas RNF-06 |
| P11 | Carga de galería visible para el público | SCRUM-136 / SCRUM-183 | ✅ Solo para el personal con sesión |
| P12 | Cabecera del portal distinta del wireframe | SCRUM-191 / SCRUM-195 | ✅ Enlaces Portal, Cronograma, Galería, Donar e Iniciar sesión |

### 4.2 Acciones fuera del repositorio para declarar el cierre

Lo que depende del código está terminado. Estas acciones las hacen personas con acceso a Supabase, GitHub o Jira:

| # | Acción | Quién | Cómo |
| :--- | :--- | :--- | :--- |
| A1 | Rotar las contraseñas iniciales en Supabase | Backend / Dirección | `python -m scripts.rotar_contrasenas_iniciales` con `DATABASE_URL` de producción ([Backend/README §5.1](../../Backend/README.md)); entregar las contraseñas por canal privado |
| A2 | Tomar las 4 capturas de Supabase y agregarlas a `docs/evidencias/` | Backend | §7 de [`EVIDENCIAS_BACKEND_SPRINT1.md`](../evidencias/EVIDENCIAS_BACKEND_SPRINT1.md) |
| A3 | Revisar y aprobar los ADR (cambiar «Propuesta» a «Aceptada» donde corresponda) | Arquitectura | [`docs/arquitectura/adr/`](../arquitectura/adr/README.md) |
| A4 | Abrir y fusionar el PR `Sprint1` → `main` con la plantilla, con los dos pipelines en verde | Dirección | <https://github.com/Joserppz/soluna-solutions/compare/main...Sprint1?expand=1> |
| A5 | En Jira: pasar las 50 subtareas a «Finalizado», cerrar SCRUM-122 (incidencias huérfanas) y SCRUM-155 (calendario y capacidad), y confirmar si existe el «SRS v2.0» que cita SCRUM-182 | Dirección | Jira |

### 4.3 Alcance de los sprints siguientes

| Requisito | Pendiente |
| :--- | :--- |
| RF-03 / RF-09 | Endpoints de inventario, «dar de baja» y generación real del acta PDF |
| RF-04 / RF-10 | API de cronogramas (SCRUM-37, SCRUM-76). La pantalla de gestión del Frontend (SCRUM-74) se adelantó al Sprint 1 y guarda los datos en el navegador hasta que exista la API |
| RF-05 / RNF-10 | Galería en Cloudinary con control de cuota (ADR-010) |
| RF-06 | Integración real con la pasarela Libélula y registro de donaciones en el Backend |
| RF-07 / RF-08 | Edición del contenido institucional |
| RF-12 | API de asistencia con la regla RNF-06 en el servidor y resumen mensual |
| RF-13 | Movimientos transaccionales de inventario con historial |
| RF-14 / RF-15 | Registro de donaciones por canal, resumen mensual y meta pública sobre donaciones confirmadas |
| RF-16 | Formulario público de contacto y preinscripciones con límite de solicitudes |
| RNF-01, RNF-03, RNF-04 | Definir el hosting, prueba de carga y auditoría de accesibilidad WCAG 2.1 AA |
| RNF-07 a RNF-09 | Respaldo y recuperación (RPO/RTO), compatibilidad de navegadores y pantallas, prueba de usabilidad y manual |

## 5. Resultado de la revisión de aceptación

**Sprint 1: completo en el repositorio.** Las historias del alcance (RF-01, RNF-02, RF-02, RNF-06, RF-11, RF-17 y RNF-11) funcionan de punta a punta, con pruebas automáticas, cobertura sobre el mínimo, recorrido integrado 11/11 y evidencia registrada. Los pendientes P1, P2 y P7 a P12 quedaron resueltos; P3 quedó resuelto en el código y solo falta ejecutarlo en Supabase (A1).

El sprint se declara **cerrado al 100%** cuando se marquen las acciones de §4.2:

- [ ] A1 · Contraseñas iniciales rotadas en Supabase (**obligatorio antes de cargar datos reales**)
- [ ] A2 · Capturas de Supabase agregadas
- [ ] A3 · ADR revisados por la arquitecta
- [ ] A4 · PR `Sprint1` → `main` fusionado
- [ ] A5 · Jira actualizado

| Documento relacionado | Contenido |
| :--- | :--- |
| [`INFORME_VERIFICACION_SPRINT1.md`](./INFORME_VERIFICACION_SPRINT1.md) | Casos probados por subtarea de verificación |
| [`../evidencias/RECORRIDO_INTEGRADO_LOGIN_PACIENTES.md`](../evidencias/RECORRIDO_INTEGRADO_LOGIN_PACIENTES.md) | Recorrido de punta a punta con capturas |
| [`../evidencias/EVIDENCIAS_CI_Y_COBERTURA_SPRINT1.md`](../evidencias/EVIDENCIAS_CI_Y_COBERTURA_SPRINT1.md) | CI y cobertura real |
| [`../evidencias/EVIDENCIAS_SPRINT1.md`](../evidencias/EVIDENCIAS_SPRINT1.md) y [`EVIDENCIAS_BACKEND_SPRINT1.md`](../evidencias/EVIDENCIAS_BACKEND_SPRINT1.md) | Evidencias visuales del Frontend y del Backend |
