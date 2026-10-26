# Soluna Solutions — Sistema Web y de Gestión para ASPAR

Repositorio oficial de **Soluna Solutions** para el proyecto **ASPAR (Asociación de Parkinson "Mario Lagrava")**, desarrollado en la materia de Ingeniería de Software — Universidad Católica Boliviana "San Pablo" (La Paz, Bolivia).

## Integrantes del Equipo

- **José Fabián Rodríguez Porco** — Director de Proyecto y Analista de Sistemas
- **Dayana Gretel Rojas Valencia** — Arquitecta de Software y Desarrolladora Backend
- **Fabián Mauricio Condorena Lazarte** — Especialista QA y Desarrollador Frontend

## Arquitectura del Repositorio

- [`Frontend/`](./Frontend/README.md): Aplicación web SPA en Vue 3 + TypeScript + Vite (Portal público y Panel administrativo/clínico).
- [`Backend/`](./Backend/README.md): API RESTful en Python + FastAPI sobre **Supabase PostgreSQL**, con autenticación JWT, sesiones, pacientes/anamnesis con protección RNF-06, documentos privados, usuarios/roles y bitácora de auditoría.
- [`docs/`](./docs/):
  - `docs/entrevistas/DOCUMENTO_1.pdf`: Minuta de entrevista y relevamiento AS-IS / TO-BE.
  - `docs/srs/DOCUMENTO_2.pdf`: Especificación de Requisitos de Software (SRS v1.0).
  - [`docs/api/CONTRATO_API_LOGIN_PACIENTES.md`](./docs/api/CONTRATO_API_LOGIN_PACIENTES.md) y [`docs/api/openapi.json`](./docs/api/openapi.json): Contrato API Backend ↔ Frontend y especificación OpenAPI.
  - [`docs/srs/SRS_ADENDA_SPRINT1.md`](./docs/srs/SRS_ADENDA_SPRINT1.md): Adenda al SRS con RF-11, RF-17, RNF-06 y RNF-11 y los cambios de RF-01, RNF-02 y RNF-05.
  - `docs/arquitectura/DOCUMENTO_3.pdf` y [`MODELO_DATOS_Y_CONTRATOS.md`](./docs/arquitectura/MODELO_DATOS_Y_CONTRATOS.md): Modelo C4 (C1, C2, C3) y contratos de datos.
  - [`docs/arquitectura/C4_Y_MODELO_ER_ACTUALIZADO.md`](./docs/arquitectura/C4_Y_MODELO_ER_ACTUALIZADO.md) y [`docs/arquitectura/adr/`](./docs/arquitectura/adr/README.md): Diagramas C4 y E-R vigentes y decisiones técnicas (ADR).
  - [`docs/trazabilidad/MATRIZ_RF01_RF17.md`](./docs/trazabilidad/MATRIZ_RF01_RF17.md): Trazabilidad completa RF01–RF17 y RNF01–RNF11.
  - `docs/bpmn/`: Modelado de procesos principales en BPMN 2.0 y revisión de pasos de usuario.
  - `docs/wireframes/`: Wireframes del portal público y del panel administrativo.
  - `docs/evidencias/`: Capturas organizadas y recorrido de aceptación del Sprint 1.

## Puesta en marcha rápida

| Paso | Backend (`Backend/`) | Frontend (`Frontend/`) |
| :--- | :--- | :--- |
| 1. Requisitos | Python 3.12+ y un proyecto Supabase | Node.js 22 LTS |
| 2. Dependencias | `python3.12 -m venv .venv`, `source .venv/bin/activate`, `pip install -r requirements-dev.txt` | `npm install` |
| 3. Entorno | `cp .env.example .env` y completar `DATABASE_URL` y `JWT_SECRET` | `cp .env.example .env` |
| 4. Base de datos | `python -m scripts.migrate` (o `--baseline 001` si la 001 ya se ejecutó en el SQL Editor) | — |
| 5. Ejecutar | `uvicorn app.main:app --reload` → <http://localhost:8000/docs> | `npm run dev` → <http://localhost:5173> |

La guía completa del Backend (variables, migraciones, permisos por rol, pruebas y problemas frecuentes) está en [`Backend/README.md`](./Backend/README.md).
