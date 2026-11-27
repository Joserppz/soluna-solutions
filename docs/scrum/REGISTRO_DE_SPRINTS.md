# Registro de sprints: objetivo, incremento, aporte y ceremonias

El proyecto se organiza en **3 sprints**, los mismos de la rúbrica: arquitectura y base de datos; UML, Jira y API; frontend e integración. En Jira el Sprint 3 aparece dividido en dos partes porque los sprints cerrados no se pueden unir. Las tareas de la entrega a ASPAR (despliegue en producción, Go/No-Go y defensa) quedan en el backlog, después del Sprint 3.

Este registro resume, por sprint:

- el objetivo y lo que se entregó;
- quién aportó, contado desde el historial de Git;
- dónde quedó cada ceremonia Scrum.

El tablero, las estimaciones y las ceremonias viven en **Jira** (proyecto `SCRUM`). Aquí queda la parte que se puede comprobar en el repositorio.

Las cifras de commits se obtienen con:

```bash
git shortlog -sne sprint1-final                       # Sprint 1
git shortlog -sne sprint1-final..sprint2-final        # Sprint 2
git shortlog -sne sprint2-final..Sprint3              # Sprint 3
```

[`.mailmap`](../../.mailmap) une las identidades de una misma persona (por ejemplo, el nombre de usuario y el nombre real), así cada integrante se cuenta una sola vez.

## Sprint 1 — Arquitectura, base de datos y acceso seguro

| | |
| :--- | :--- |
| **Fechas** | Jira: 19/10 al 01/11/2026, cerrado el 28/10 (etiqueta `sprint1-final`, `v1.0`). Antes, desde el 12/08: entrevista, SRS, C4, BPMN y wireframes |
| **Objetivo** | Arquitectura aprobada (C4, ADR), base de datos con migraciones y el primer incremento de punta a punta: acceso del personal, fichas de afiliados con protección clínica, usuarios con roles y bitácora |
| **Historias** | RF-01, RNF-02, RF-02, RNF-06, RF-11, RF-17, RNF-11 ([DoD y estado](../calidad/DEFINICION_DE_HECHO_Y_ESTADO_SPRINT1.md)) |
| **Incremento** | Login con bloqueo por intentos, sesión con expiración, fichas y anamnesis, usuarios y roles, bitácora; CI con cobertura mínima ([evidencias](../evidencias/EVIDENCIAS_SPRINT1.md)) |
| **Artefactos** | Entrevista y SRS ([`DOCUMENTO_1`](../entrevistas/DOCUMENTO_1.pdf), [`DOCUMENTO_2`](../srs/DOCUMENTO_2.pdf)), C4 ([`DOCUMENTO_3`](../arquitectura/DOCUMENTO_3.pdf), [`modelos/c4`](../../modelos/c4/)), ADR-001 a ADR-010, BPMN, wireframes |
| **Integración** | Pull Requests #1 a #4 (`arquitectura`, `srs`, `entrevista`, `SCRUM-65`) hacia la rama del sprint |
| **Commits** | José 47 · Mauricio 25 · Dayana 19 |

## Sprint 2 — API completa, diseño y Jira

| | |
| :--- | :--- |
| **Fechas** | Jira: 01/11 al 16/11/2026 (etiqueta `sprint2-final`, `v2.0`, del 13/11) |
| **Objetivo** | API REST completa por módulos de dominio con contrato OpenAPI, y todas las pantallas del equipo y del sitio conectadas a ella |
| **Historias** | RF-03 a RF-10, RF-12 a RF-16 (alcance en [§4.3 del DoD](../calidad/DEFINICION_DE_HECHO_Y_ESTADO_SPRINT1.md#43-alcance-de-los-sprints-siguientes)) |
| **Incremento** | Inventario con movimientos, actividades y asistencia, galería en Cloudinary, donaciones sin pasarela con meta pública, solicitudes, contenido del sitio, permisos editables por rol; frontend F1 a F7 ([evidencias F1](../evidencias/EVIDENCIAS_FRONTEND_F1.md) … [F7](../evidencias/EVIDENCIAS_FRONTEND_F7.md)); despliegue en Cloud Run, Supabase y Cloudflare Pages |
| **Artefactos** | ADR-011 a ADR-014, contrato [`openapi.json`](../api/openapi.json), [matriz de trazabilidad](../trazabilidad/MATRIZ_RF01_RF17.md) |
| **Commits** | Mauricio 29 · Rosav-dotcom 24 · José 4 |

## Sprint 3 — Frontend integrado, reportes y plan de mejora

| | |
| :--- | :--- |
| **Fechas** | Jira lo registra en dos partes: «Sprint 3 (parte 1) — Frontend: portal y multimedia» (11/11 al 25/11/2026) y «Sprint 3 (parte 2) — Integración, reportes y cierre» (18/11 al 27/11/2026). Cierra con la etiqueta `v3.0` |
| **Objetivo** | Responder a la evaluación de los Sprints 1 y 2: filtro por fechas y reportes completos en cada pantalla, logging de lo filtrado y lo exportado, y un incremento integrado y probado de punta a punta |
| **Incremento** | Rango de fechas y «Descargar» en 9 pantallas, Excel y PDF ([ADR-015](../arquitectura/adr/ADR-015-filtros-por-fecha-y-reportes.md), [evidencia](../evidencias/EVIDENCIAS_SPRINT3_REPORTES.md)); calendario propio y menús flotantes; diagramas UML ([paquete UML](../arquitectura/UML_CLASES_Y_SECUENCIAS.md)); pruebas unitarias de reglas de negocio ([`tests/unit`](../../Backend/tests/unit/)); backlog según [ISO 29148](../srs/BACKLOG_ISO29148.md); [manual del usuario](../manual/MANUAL_DE_USUARIO.md); monitoreo de disponibilidad; despliegue en la región de la base |
| **Commits (hasta ahora)** | José 6 |

## Ceremonias Scrum

Se registran en Jira, que es lo que revisa el docente. Esta tabla dice qué debe mostrar cada una y dónde.

| Ceremonia | Qué queda registrado | Dónde |
| :--- | :--- | :--- |
| **Sprint Planning** | Objetivo del sprint, historias elegidas por prioridad MoSCoW, estimación en story points y responsable de cada subtarea | Jira: el sprint y su objetivo, el backlog y las historias con story points y responsable |
| **Daily** | Avance y bloqueos de cada integrante | Jira: comentarios o un registro breve por día en la historia o en Confluence |
| **Sprint Review** | Incremento demostrado y aceptado | Este registro, `docs/evidencias/` y el recorrido E2E |
| **Retrospectiva** | Qué salió bien, qué mejorar y acciones concretas con responsable | Jira o Confluence: una página por sprint. Las acciones pasan como tareas al sprint siguiente |

### Retroalimentación recibida y acciones

| Origen | Hallazgo | Acción | Estado |
| :--- | :--- | :--- | :--- |
| Evaluación de los Sprints 1 y 2 (18/11/2026) | Faltaban filtro por fechas y reportes completos | Filtro y descarga en 9 pantallas, logging y pruebas | Hecho ([evidencia](../evidencias/EVIDENCIAS_SPRINT3_REPORTES.md)) |
| Evaluación de los Sprints 1 y 2 | Asignar responsables en el tablero | Cada historia y subtarea con responsable en Jira | Pendiente del equipo |
| Evaluación de los Sprints 1 y 2 | Coordinación interna | Revisión cruzada de cada pantalla antes de cerrarla | Pendiente del equipo |
| Rúbrica de Sprints 1 a 3 | Paquete UML, pruebas unitarias con dobles, etiquetas de versión | UML, `tests/unit` y etiquetas `v1.0`, `v2.0` y `v3.0` | Hecho en el repositorio; las etiquetas las crea el equipo ([guía](../git/FLUJO_GIT_Y_PULL_REQUESTS.md#7-etiquetas-de-versión)) |

## Colaboración equitativa

Para que el aporte de cada integrante se vea en el repositorio:

- Cada integrante trabaja su parte en su propia rama (`SCRUM-XX`) y la integra por Pull Request.
- Otro integrante revisa y aprueba ese PR: la revisión también queda registrada con su nombre.
- Cada quien hace sus commits con su propia cuenta y con un único correo configurado en `git config user.email`.
