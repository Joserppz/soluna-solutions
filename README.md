# Soluna Solutions — Sistema Web y de Gestión para ASPAR

Repositorio oficial de **Soluna Solutions** para el proyecto **ASPAR (Asociación de Parkinson "Mario Lagrava")**, desarrollado en la materia de Ingeniería de Software — Universidad Católica Boliviana "San Pablo" (La Paz, Bolivia).

## Integrantes del Equipo

- **José Fabián Rodríguez Porco** — Director de Proyecto y Analista de Sistemas
- **Dayana Gretel Rojas Valencia** — Arquitecta de Software y Desarrolladora Backend
- **Fabián Mauricio Condorena Lazarte** — Especialista QA y Desarrollador Frontend

## Arquitectura del Repositorio

- [`Frontend/`](./Frontend/README.md): Aplicación web SPA en Vue 3 + TypeScript + Vite (Portal público y Panel administrativo/clínico).
- [`Backend/`](./Backend/app/main.py): API RESTful en Python + FastAPI con autenticación JWT, gestión de pacientes/anamnesis, usuarios/roles y bitácora de auditoría.
- [`docs/`](./docs/):
  - `docs/entrevistas/DOCUMENTO_1.pdf`: Minuta de entrevista y relevamiento AS-IS / TO-BE.
  - `docs/srs/DOCUMENTO_2.pdf`: Especificación de Requisitos de Software (SRS v1.0).
  - `docs/arquitectura/DOCUMENTO_3.pdf` y [`MODELO_DATOS_Y_CONTRATOS.md`](./docs/arquitectura/MODELO_DATOS_Y_CONTRATOS.md): Modelo C4 (C1, C2, C3) y contratos de datos.
  - [`docs/trazabilidad/MATRIZ_RF01_RF17.md`](./docs/trazabilidad/MATRIZ_RF01_RF17.md): Trazabilidad completa RF01–RF17 y RNF01–RNF11.
  - `docs/bpmn/`: Modelado de procesos principales en BPMN 2.0 y revisión de pasos de usuario.
  - `docs/wireframes/`: Wireframes del portal público y del panel administrativo.
  - `docs/evidencias/`: Capturas organizadas y recorrido de aceptación del Sprint 1.
