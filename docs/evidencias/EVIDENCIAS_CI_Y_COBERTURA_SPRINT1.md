# Evidencia de CI y Cobertura Real de Pruebas — Sprint 1 (SCRUM-61 / SCRUM-97)

Este documento registra qué valida cada pipeline de GitHub Actions, el resultado de las ejecuciones sobre `Sprint1` y la **cobertura real** medida en el Frontend y el Backend.

## 1. Pipelines y lo que validan

| Pipeline | Archivo | Se ejecuta en | Validaciones |
| :--- | :--- | :--- | :--- |
| **Frontend** | `.github/workflows/ci-frontend.yml` | `push` a `main`, `Sprint*`, `SCRUM-*`, `feature/**` y PR hacia `main` / `Sprint*` | ESLint → Prettier → Vitest **con cobertura (mínimo 70%)** → build con `vue-tsc` |
| **Backend** | `.github/workflows/ci-backend.yml` | Mismas ramas, cuando cambia `Backend/**` o `Frontend/src/types/**` | Ruff (lint y formato) → migraciones sobre PostgreSQL 16 vacío → pytest **con cobertura (mínimo 70%)** |

Ambos pipelines publican la cobertura en el **resumen de la ejecución** (pestaña *Summary* de Actions) y como **artefacto descargable**:

| Artefacto | Contenido |
| :--- | :--- |
| `frontend-coverage` | `coverage-summary.json` y `lcov.info` |
| `backend-pytest-report` | `pytest-report.xml` (JUnit) y `coverage.xml` (Cobertura) |

El mínimo de **70%** sale de **RNF-05** del SRS. Si la cobertura baja de ese valor, el pipeline falla y el PR no se puede fusionar en verde.

## 2. Ejecuciones registradas sobre `Sprint1`

| Ejecución | Commit | Pipeline | Resultado |
| :--- | :--- | :--- | :--- |
| [#8](https://github.com/Joserppz/soluna-solutions/actions/runs/40391107949) | `fb29a00` (fusión del PR #4) | Backend: Ruff, migraciones y pytest | ✅ Éxito |
| [#25](https://github.com/Joserppz/soluna-solutions/actions/runs/40391107757) | `fb29a00` (fusión del PR #4) | Frontend: lint, pruebas y build | ✅ Éxito |
| [#7](https://github.com/Joserppz/soluna-solutions/actions/runs/40348612943) | `195a8be` | Frontend: lint, pruebas y build | ✅ Éxito |

Esas ejecuciones son anteriores a la medición de cobertura. A partir de este cambio, cada ejecución deja la cobertura en su resumen.

## 3. Cobertura real medida

### 3.1 Resumen

| Componente | Pruebas | Líneas | Sentencias | Funciones | Ramas | Mínimo RNF-05 |
| :--- | ---: | ---: | ---: | ---: | ---: | :--- |
| **Backend** (`Backend/app`) | 99 | — | **96,94%** (983/1014) | — | — | ✅ Cumple |
| **Frontend** (`Frontend/src`) | 38 | **80,30%** (583/726) | 78,98% (605/766) | 71,85% (143/199) | 80,14% (553/690) | ✅ Cumple |

**Evolución del Frontend durante el Sprint 1:**

| Momento | Pruebas | Líneas |
| :--- | ---: | ---: |
| Primera medición (solo pruebas de Login, Pacientes, Usuarios y Bitácora) | 22 | 53,73% |
| + permisos por rol en el router (SCRUM-162) | 28 | 63,66% |
| + pruebas de pantallas contra requisitos (SCRUM-196) | 36 | 79,47% |
| + integración del login con la API (SCRUM-88) | 38 | **80,30%** |

### 3.2 Frontend por archivo

| Archivo | Sentencias | Ramas | Funciones | Líneas |
| :--- | ---: | ---: | ---: | ---: |
| `router/index.ts` | 100% | 92,85% | 100% | 100% |
| `services/api.ts` | 91,3% | 69,23% | 93,33% | 95,23% |
| `services/aspar.ts` | 81,96% | 70,39% | 93,87% | 83,25% |
| `views/AttendanceView.vue` | 93,33% | 87,5% | 87,5% | 96,55% |
| `views/AuditView.vue` | 96,96% | 96,77% | 100% | 100% |
| `views/InventoryView.vue` | 90,56% | 92,15% | 73,33% | 92% |
| `views/LoginView.vue` | 91,52% | 90,9% | 100% | 91,07% |
| `views/PatientsView.vue` | 82,27% | 90,59% | 57,69% | 83,11% |
| `views/RegisterPatientView.vue` | 79,16% | 98,63% | 47,36% | 79,16% |
| `views/ScheduleView.vue` | 86% | 90,47% | 81,25% | 87,75% |
| `views/UsersView.vue` | 88% | 92,85% | 75% | 89,58% |
| `App.vue` | 0% | 0% | 0% | 0% |

### 3.3 Backend por módulo

| Módulo | Cobertura | Líneas sin cubrir |
| :--- | ---: | :--- |
| `routers/*` (auth, patients, patient_documents, users, audit) | 100% | — |
| `services/auth_service.py` | 100% | — |
| `services/patient_service.py` | 97% | 3 |
| `services/user_service.py` | 98% | 2 |
| `services/document_service.py` | 89% | 7 |
| `services/audit_service.py` | 89% | 2 |
| `core/deps.py` | 98% | 1 |
| `core/security.py`, `core/errors.py`, `core/constants.py` | 100% | — |
| `core/database.py` | 61% | 7 (conexión real fuera de pruebas) |
| `models/*`, `repositories/*` | 90% – 100% | 2 |
| `adapters/storage.py`, `core/config.py`, `main.py`, `schemas/*` | 92% – 100% | 7 |
| **Total** | **96,94%** | 31 de 1014 |

### 3.4 Zonas sin cubrir y riesgo

| Zona | Motivo | Riesgo | Acción |
| :--- | :--- | :--- | :--- |
| `Frontend/src/App.vue` (0%) | Barra superior, contador y banner de sesión; se prueba la lógica en `aspar.ts`, no el componente | Medio: un error visual en la renovación no se detectaría | Agregar prueba de componente en el Sprint 2 |
| `services/api.ts` (ramas 69%) | Respuestas de error con cuerpo no JSON | Bajo | Cubrir al conectar los módulos del Sprint 2 |
| `core/database.py` (61%) | Creación del motor con la base real | Bajo: la cubre el paso de migraciones del CI | — |

## 4. Cómo reproducir las cifras

```bash
# Frontend
cd Frontend
npm ci
npm run test:coverage          # tabla por archivo + coverage/coverage-summary.json

# Backend (necesita un PostgreSQL de pruebas, NUNCA el de Supabase)
cd Backend
pip install -r requirements-dev.txt
TEST_DATABASE_URL=postgresql://usuario:clave@localhost:5432/aspar_test \
  pytest --cov=app --cov-report=term-missing --cov-fail-under=70
```
