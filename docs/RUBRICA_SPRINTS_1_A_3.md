# Guía de evaluación: rúbrica de los Sprints 1 a 3 y dónde está cada evidencia

Este documento recorre el **Formulario de Control y Auditoría de los Sprints 1, 2 y 3** (SIS-213) punto por punto. Para cada criterio dice dónde está la evidencia en el repositorio y cómo comprobarla en pocos minutos.

ASPAR es un proyecto integrador del tipo **«Otro»**. Las tecnologías de la rúbrica (SQL Server, .NET 8, Flutter, xUnit y Moq) son un ejemplo; cada criterio se cumple con su equivalente, elegido y justificado en un ADR:

| La rúbrica nombra | En ASPAR | Por qué ([ADR](./arquitectura/adr/README.md)) |
| :--- | :--- | :--- |
| SQL Server 2022 + proyecto `.sqlproj` | PostgreSQL 16 (Supabase) + scripts DDL versionados en [`Backend/migrations/`](../Backend/migrations/) | [ADR-002](./arquitectura/adr/ADR-002-postgresql-supabase-y-migraciones-sql.md) |
| Web API .NET 8: Controllers y Services | FastAPI (Python 3.12): `router.py` (controlador), `service.py`, `repository.py` por módulo | [ADR-001](./arquitectura/adr/ADR-001-api-fastapi-en-capas.md), [ADR-011](./arquitectura/adr/ADR-011-backend-por-modulos-de-dominio.md) |
| App Flutter/Web | SPA Vue 3 + TypeScript (portal público y espacio del equipo) | [ADR-013](./arquitectura/adr/ADR-013-contrato-openapi-y-capa-src-api.md) |
| JWT | JWT firmado en cookie HttpOnly, con CSRF y sesión validada en el servidor | [ADR-003](./arquitectura/adr/ADR-003-jwt-con-sesiones-en-servidor.md), [ADR-012](./arquitectura/adr/ADR-012-sesion-en-cookies-y-permisos-en-la-base.md) |
| xUnit + Moq | pytest + `unittest.mock` (Backend) y Vitest con API simulada (Frontend) | [`Backend/tests/unit/`](../Backend/tests/unit/) |
| `/src` | [`Backend/`](../Backend/) y [`Frontend/`](../Frontend/) (código), con [`/docs`](./) y [`/modelos`](../modelos/) | Una carpeta por contenedor del C4 |

## Revisión rápida (5 minutos)

```bash
docker compose up --build -d             # base, API y web
# http://localhost:8000/docs  → Swagger con los 114 endpoints
# http://localhost:5173       → la aplicación (cuentas de demostración: make seed)
make test-unit                           # 42 pruebas unitarias de reglas de negocio, sin base
make test                                # todas las pruebas con cobertura
git shortlog -sne                        # aporte por integrante
git tag -n                               # versiones v1.0, v2.0, v3.0
```

## Sprint 1 — Arquitectura y base de datos (20 pts)

| Entregable | Criterio de validación | Evidencia |
| :--- | :--- | :--- |
| **1.1 Modelo C4 (niveles 1 a 3)** | C4 N1–N3 completo, con tecnologías y ADR | [Principios de diseño](./arquitectura/PRINCIPIOS_DE_DISENO.md) (monolito modular, SOLID con ejemplos del código). [`modelos/c4/`](../modelos/c4/) (C1, C2 y C3 originales), [C4 vigente con tecnologías](./arquitectura/C4_Y_MODELO_ER_ACTUALIZADO.md) (contexto, contenedores y componentes de la API), [`DOCUMENTO_3.pdf`](./arquitectura/DOCUMENTO_3.pdf). **15 ADR** en [`docs/arquitectura/adr/`](./arquitectura/adr/README.md): ADR-001 (API en capas) y ADR-002 (PostgreSQL y migraciones) en adelante |
| **1.2 Base de datos** | Esquema relacional normalizado, con transacciones ACID | 6 migraciones SQL versionadas con su SHA-256 ([`Backend/migrations/`](../Backend/migrations/), [`scripts/migrate.py`](../Backend/scripts/migrate.py)): 25 tablas normalizadas, claves primarias (UUID en las entidades), 42 claves foráneas con `ON DELETE` explícito, 36 índices (incluye `pg_trgm` para búsqueda y un índice único que impide confirmar dos aportes con la misma referencia) y más de 130 restricciones `CHECK`. **ACID:** una transacción por petición con `commit`/`rollback` único ([`app/core/database.py`](../Backend/app/core/database.py)) y bloqueo de fila (`SELECT … FOR UPDATE`) en confirmaciones, stock y asistencia. Modelo E-R en el [C4 vigente](./arquitectura/C4_Y_MODELO_ER_ACTUALIZADO.md). Cada corrida de pytest en el CI crea el esquema desde cero con estas migraciones ([`tests/conftest.py`](../Backend/tests/conftest.py)) y `test_migrations.py` verifica su orden |

## Sprint 2 — Diseño UML, Jira y API (25 pts)

| Entregable | Criterio de validación | Evidencia |
| :--- | :--- | :--- |
| **2.1 Paquete UML** | Clases completas y secuencias | [Paquete UML](./arquitectura/UML_CLASES_Y_SECUENCIAS.md): diagrama de clases del dominio (19 clases, vista general y tres vistas de detalle con atributos, multiplicidades y enumeraciones) y **4 diagramas de secuencia**: alta de afiliado, confirmación de pago (donación), descarga de reporte y toma de asistencia. Fuentes editables en [`modelos/uml/`](../modelos/uml/) |
| **2.2 Backlog en Jira con ISO 29148** | Prioridad MoSCoW, fuente y riesgo por historia | [Backlog ISO 29148](./srs/BACKLOG_ISO29148.md): 17 RF y 11 RNF con historia de Jira (`SCRUM-n`), fuente, MoSCoW, riesgo, estabilidad, método de verificación y prueba. SRS v1.0 ([`DOCUMENTO_2.pdf`](./srs/DOCUMENTO_2.pdf)) y [adenda](./srs/SRS_ADENDA_SPRINT1.md). En Jira, proyecto `SCRUM` |
| **2.3 Web API REST** | API con endpoints CRUD funcionales y Swagger | 114 endpoints en 16 módulos ([`Backend/app/modules/`](../Backend/app/modules/)). Swagger en `/docs` y contrato [`docs/api/openapi.json`](./api/openapi.json), que el CI compara con el código (`test_openapi.py`) y con los tipos del Frontend (`npm run api:types:check`) |

## Sprint 3 — Frontend e incremento integrado (25 pts)

En Jira este sprint de la rúbrica se registra como dos: **Sprint 3** (portal y multimedia) y **Sprint 4** (integración, reportes y cierre). Ver el [registro de sprints](./scrum/REGISTRO_DE_SPRINTS.md).

| Entregable | Criterio de validación | Evidencia |
| :--- | :--- | :--- |
| **3.1 Cliente frontend** | UI reactiva que consume endpoints asíncronos con JWT | SPA Vue 3 ([`Frontend/`](../Frontend/README.md)): capa [`src/api/`](../Frontend/src/api/) con `fetch` asíncrono, cookies de sesión, CSRF y renovación del JWT; pantallas reactivas (listas, filtros en la dirección, paneles y modales). Evidencias por pantalla: F1 a F7 en [`docs/evidencias/`](./evidencias/). [Manual del usuario](./manual/MANUAL_DE_USUARIO.md) con capturas actuales |
| **3.2 Pruebas unitarias** | Validan las reglas de negocio centrales | **Backend:** 42 pruebas unitarias con dobles en [`Backend/tests/unit/`](../Backend/tests/unit/) (confirmación de aportes, stock, asistencia, privacidad clínica) y 483 de API contra PostgreSQL. **Frontend:** 413 pruebas Vitest con la API simulada. Cobertura: Backend 98 %, Frontend 92,7 % de líneas (mínimo 70 % en el CI) |
| **3.3 Incremento funcional** | Cliente + API + base, probado de punta a punta | 121 recorridos E2E con Playwright contra la API y la base reales de Docker ([`Frontend/e2e/`](../Frontend/e2e/)), entre ellos reportes ([`reportes.spec.ts`](../Frontend/e2e/reportes.spec.ts)) y accesibilidad de 360 a 1920 px. Incremento del Sprint 3: [filtros y reportes en Excel y PDF](./evidencias/EVIDENCIAS_SPRINT3_REPORTES.md). Desplegado en Cloud Run, Supabase y Cloudflare Pages ([guía](./despliegue/DESPLIEGUE_SIN_DOMINIO.md)) |

## Gestión de Git y trazabilidad (15 pts)

| Entregable | Criterio de validación | Evidencia |
| :--- | :--- | :--- |
| **4.1 Repositorio GitHub** | Carpetas `/docs`, `/src` y `/modelos` | [`docs/`](./), [`modelos/`](../modelos/) (C4 y UML) y el código en [`Backend/`](../Backend/) y [`Frontend/`](../Frontend/) |
| **4.2 Flujo de trabajo** | Commits claros (`feat`, `docs`, `fix`), al menos 3 ramas integradas, etiquetas de versión | Commits con [Conventional Commits](./git/FLUJO_GIT_Y_PULL_REQUESTS.md#52-commits) y la historia de Jira (`feat(SCRUM-n): …`). Ramas por historia integradas por Pull Request (#1 a #4); `Sprint1` y `Sprint2` integradas en `main`, y `Sprint3` se integra al cierre. Etiquetas `v1.0`, `v2.0` y `v3.0` ([guía](./git/FLUJO_GIT_Y_PULL_REQUESTS.md#7-etiquetas-de-versión)) |
| **4.3 Trazabilidad** | Matriz RF ↔ Jira ↔ código actualizada | [Matriz de trazabilidad](./trazabilidad/MATRIZ_RF01_RF17.md): RF-01 a RF-17 y RNF-01 a RNF-11 → historia y subtareas de Jira → módulo → endpoints → pruebas → estado, actualizada al Sprint 3 |

## Desempeño del equipo Scrum (15 pts)

| Entregable | Criterio de validación | Evidencia |
| :--- | :--- | :--- |
| **5.1 Ceremonias Scrum** | Cumplimiento del objetivo del sprint y estimación en story points | Jira: sprints con objetivo, historias con story points y responsable. [Registro de sprints](./scrum/REGISTRO_DE_SPRINTS.md): objetivo, incremento y acciones de cada sprint. [Retrospectivas](./scrum/RETROSPECTIVAS.md) con acciones y responsables. [Definición de Hecho](./calidad/DEFINICION_DE_HECHO_Y_ESTADO_SPRINT1.md) |
| **5.2 Colaboración equitativa** | Aporte visible en los commits de cada integrante | `git shortlog -sne` por sprint, en el [registro de sprints](./scrum/REGISTRO_DE_SPRINTS.md#colaboración-equitativa). [`.mailmap`](../.mailmap) une las identidades de una misma persona |

## Lo que el equipo debe dejar listo antes de la revisión

Estas acciones viven fuera del código. Están en la [lista de acciones del registro de sprints](./scrum/REGISTRO_DE_SPRINTS.md#retroalimentación-recibida-y-acciones):

1. Crear las etiquetas `v1.0` y `v2.0` y, al cerrar el sprint, integrar `Sprint3` en `main` por Pull Request y etiquetar `v3.0`.
2. En Jira: objetivo de cada sprint, story points, prioridad MoSCoW y responsable en cada historia (completo). Las retrospectivas están en [`RETROSPECTIVAS.md`](./scrum/RETROSPECTIVAS.md).
3. Que cada integrante tenga commits o Pull Requests propios en el Sprint 3, aunque sea revisar y aprobar los PR de los demás.
