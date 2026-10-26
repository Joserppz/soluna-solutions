## Descripción del Cambio (Historia / Tarea de Jira)
- **Rama / Historia o Tarea Padre**: `SCRUM-XX`
- **Subtarea(s) implementada(s)**: `SCRUM-YY` (Frontend / Backend)
- **Requisito(s) cubierto(s)**: `RF-XX` / `RNF-XX`

## Resumen de Cambios Realizados
- [ ] Implementación / actualización de vistas o componentes en `Frontend/src/`
- [ ] Endpoints, servicios o repositorios en `Backend/app/` (routers → services → repositories)
- [ ] Migración SQL nueva y numerada en `Backend/migrations/` (sin editar migraciones aplicadas)
- [ ] Integración con `Frontend/src/services/api.ts` respetando `Frontend/src/types/aspar.ts`
- [ ] Validaciones de formulario y reglas de protección de datos (`RNF-06`)
- [ ] Operaciones sensibles registradas en la bitácora (`RF-17`)
- [ ] Pruebas: `eslint`, `prettier`, `vue-tsc`, Vitest (Frontend) / `ruff`, `pytest` (Backend)

## Evidencia de Verificación
- Capturas o salidas adjuntas en `docs/evidencias/`
- Pipelines en verde: `.github/workflows/ci-frontend.yml` y `.github/workflows/ci-backend.yml`
