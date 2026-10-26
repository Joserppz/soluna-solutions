# Flujo de Git: Ramas por Historia/Tarea Padre, Subtareas y Pull Requests (SCRUM-65 / SCRUM-108)

Este documento registra la estrategia de ramificación por **Historia o Tarea Padre de Jira** aplicada en el repositorio `Joserppz/soluna-solutions`. Cada rama lleva el nombre de la **Historia o Tarea** (ej. `SCRUM-11`) y dentro de ella se sube el commit y parche de su **Subtarea de Frontend** (ej. `SCRUM-66`).

## 1. Mapa de Ramas por Historia/Tarea Padre y su Subtarea

| Orden | Rama Git (Historia / Tarea) | Subtarea en el Commit | Archivo de Parche (`.patch`) | Mensaje de Commit Semántico | PR Sugerido hacia `main` |
| :--- | :--- | :--- | :--- | :--- | :--- |
| **01** | `SCRUM-64` | `SCRUM-105` | `01-RAMA-SCRUM-64__subtarea-SCRUM-105.patch` | `feat(SCRUM-64/SCRUM-105): alinear tipos, contratos DTO y migraciones con el modelo de datos C4` | `PR: [SCRUM-64] Arquitectura C4 y contratos de datos (SCRUM-105)` |
| **02** | `SCRUM-58` | `SCRUM-87` | `02-RAMA-SCRUM-58__subtarea-SCRUM-87.patch` | `feat(SCRUM-58/SCRUM-87): integrar servicios de login, pacientes, usuarios y bitacora con API FastAPI` | `PR: [SCRUM-58] Integración E2E login y pacientes con API (SCRUM-87)` |
| **03** | `SCRUM-11` | `SCRUM-66` | `03-RAMA-SCRUM-11__subtarea-SCRUM-66.patch` | `feat(SCRUM-11/SCRUM-66): implementar validaciones de entrada, control de intentos y autenticacion API en LoginView` | `PR: [SCRUM-11] RF01 Inicio de sesión administrativo (SCRUM-66)` |
| **04** | `SCRUM-12` | `SCRUM-67` | `04-RAMA-SCRUM-12__subtarea-SCRUM-67.patch` | `feat(SCRUM-12/SCRUM-67): gestionar expiracion de sesion JWT, alerta de inactividad, renovacion y cierre de sesion` | `PR: [SCRUM-12] RNF02 Sesiones, tokens JWT y cierre de sesión (SCRUM-67)` |
| **05** | `SCRUM-13` | `SCRUM-68` | `05-RAMA-SCRUM-13__subtarea-SCRUM-68.patch` | `feat(SCRUM-13/SCRUM-68): ampliar formulario de pacientes con anamnesis digital, validaciones y sincronizacion API` | `PR: [SCRUM-13] RF02 Fichas de pacientes y anamnesis digital (SCRUM-68)` |
| **06** | `SCRUM-123` | `SCRUM-138` | `06-RAMA-SCRUM-123__subtarea-SCRUM-138.patch` | `feat(SCRUM-123/SCRUM-138): aplicar proteccion de datos clinicos, control de consentimiento y estados de acceso en el sistema` | `PR: [SCRUM-123] RNF06 Proteger datos y consentimiento de pacientes (SCRUM-138)` |
| **07** | `SCRUM-129` | `SCRUM-161` | `07-RAMA-SCRUM-129__subtarea-SCRUM-161.patch` | `feat(SCRUM-129/SCRUM-161): alinear pantalla de usuarios y roles con Jira y conectar con API REST` | `PR: [SCRUM-129] RF11 Gestionar usuarios y roles (SCRUM-161)` |
| **08** | `SCRUM-135` | `SCRUM-179` | `08-RAMA-SCRUM-135__subtarea-SCRUM-179.patch` | `feat(SCRUM-135/SCRUM-179): implementar bitacora de auditoria de operaciones sensibles con control de rol Administrador y filtros` | `PR: [SCRUM-135] RF17 Auditoría de operaciones sensibles (SCRUM-179)` |
| **09** | `SCRUM-136` | `SCRUM-183` | `09-RAMA-SCRUM-136__subtarea-SCRUM-183.patch` | `feat(SCRUM-136/SCRUM-183): alinear pantallas, portal publico, inventario, donaciones y recorridos con RF01-RF17` | `PR: [SCRUM-136] Trazabilidad de pantallas y recorridos RF01–RF17 (SCRUM-183)` |
| **10** | `SCRUM-128` | `SCRUM-153` | `10-RAMA-SCRUM-128__subtarea-SCRUM-153.patch` | `feat(SCRUM-128/SCRUM-153): configurar parser TypeScript en ESLint, formatear con Prettier y agregar suite de pruebas unitarias` | `PR: [SCRUM-128] RNF11 ESLint, Prettier y pruebas de componentes (SCRUM-153)` |
| **11** | `SCRUM-59` | `SCRUM-91` | `11-RAMA-SCRUM-59__subtarea-SCRUM-91.patch` | `docs(SCRUM-59/SCRUM-91): documentar instalacion, ejecucion, roles y archivos .env.example del proyecto ASPAR` | `PR: [SCRUM-59] Documentación README y .env.example (SCRUM-91)` |
| **12** | `SCRUM-61` | `SCRUM-96` | `12-RAMA-SCRUM-61__subtarea-SCRUM-96.patch` | `ci(SCRUM-61/SCRUM-96): agregar pipeline de GitHub Actions con validaciones automaticas de lint, test y build` | `PR: [SCRUM-61] CI/CD pipeline, lint y pruebas automáticas (SCRUM-96)` |
| **13** | `SCRUM-190` | `SCRUM-194` | `13-RAMA-SCRUM-190__subtarea-SCRUM-194.patch` | `docs(SCRUM-190/SCRUM-194): agregar modelado BPMN 2.0 y revision de pasos de usuario contra la interfaz` | `PR: [SCRUM-190] Modelado de procesos BPMN 2.0 (SCRUM-194)` |
| **14** | `SCRUM-191` | `SCRUM-195` | `14-RAMA-SCRUM-191__subtarea-SCRUM-195.patch` | `docs(SCRUM-191/SCRUM-195): preparar wireframes identificables del portal publico y del panel administrativo` | `PR: [SCRUM-191] Wireframes del portal y del panel (SCRUM-195)` |
| **15** | `SCRUM-57` | `SCRUM-85` | `15-RAMA-SCRUM-57__subtarea-SCRUM-85.patch` | `docs(SCRUM-57/SCRUM-85): registrar capturas organizadas y recorrido de aceptacion del Sprint 1` | `PR: [SCRUM-57] Evidencias visuales y recorrido del Sprint 1 (SCRUM-85)` |
| **16** | `SCRUM-65` | `SCRUM-108` | `16-RAMA-SCRUM-65__subtarea-SCRUM-108.patch` | `docs(SCRUM-65/SCRUM-108): agregar plantilla de Pull Request y guia de flujo Git por ramas de historia/tarea` | `PR: [SCRUM-65] Flujo de Git: ramas por tarea, commits y PRs (SCRUM-108)` |

## 2. Opción A: Subir directamente las ramas de Historia/Tarea desde el ZIP actualizado

El archivo `soluna-solutions-ramas-por-tarea.zip` ya tiene creadas las **16 ramas por Historia/Tarea** (`SCRUM-11`, `SCRUM-12`, `SCRUM-13`, `SCRUM-123`, `SCRUM-128`, `SCRUM-129`, `SCRUM-135`, `SCRUM-57`, `SCRUM-58`, `SCRUM-59`, `SCRUM-61`, `SCRUM-64`, `SCRUM-65`, `SCRUM-136`, `SCRUM-190`, `SCRUM-191`). Solo necesitas ejecutar:

```bash
# Subir todas las ramas de Historia/Tarea al repositorio remoto en GitHub
git push -u origin SCRUM-64 SCRUM-58 SCRUM-11 SCRUM-12 SCRUM-13 SCRUM-123 SCRUM-129 SCRUM-135 SCRUM-136 SCRUM-128 SCRUM-59 SCRUM-61 SCRUM-190 SCRUM-191 SCRUM-57 SCRUM-65 --force-with-lease
```

## 3. Opción B: Aplicar los parches (`.patch`) creando cada rama de Historia/Tarea paso a paso

Si prefieres ir creando cada rama de **Historia/Tarea** sobre tu repositorio local aplicando su parche correspondiente:

```bash
# 1. Tarea SCRUM-64 (Subtarea SCRUM-105)
git checkout -b SCRUM-64 c81696e
git am parches-por-tarea-historia/01-RAMA-SCRUM-64__subtarea-SCRUM-105.patch

# 2. Tarea SCRUM-58 (Subtarea SCRUM-87)
git checkout -b SCRUM-58 SCRUM-64
git am parches-por-tarea-historia/02-RAMA-SCRUM-58__subtarea-SCRUM-87.patch

# 3. Historia SCRUM-11 (Subtarea SCRUM-66)
git checkout -b SCRUM-11 SCRUM-58
git am parches-por-tarea-historia/03-RAMA-SCRUM-11__subtarea-SCRUM-66.patch

# 4. Historia SCRUM-12 (Subtarea SCRUM-67)
git checkout -b SCRUM-12 SCRUM-11
git am parches-por-tarea-historia/04-RAMA-SCRUM-12__subtarea-SCRUM-67.patch

# 5. Historia SCRUM-13 (Subtarea SCRUM-68)
git checkout -b SCRUM-13 SCRUM-12
git am parches-por-tarea-historia/05-RAMA-SCRUM-13__subtarea-SCRUM-68.patch

# 6. Historia SCRUM-123 (Subtarea SCRUM-138)
git checkout -b SCRUM-123 SCRUM-13
git am parches-por-tarea-historia/06-RAMA-SCRUM-123__subtarea-SCRUM-138.patch

# 7. Historia SCRUM-129 (Subtarea SCRUM-161)
git checkout -b SCRUM-129 SCRUM-123
git am parches-por-tarea-historia/07-RAMA-SCRUM-129__subtarea-SCRUM-161.patch

# 8. Historia SCRUM-135 (Subtarea SCRUM-179)
git checkout -b SCRUM-135 SCRUM-129
git am parches-por-tarea-historia/08-RAMA-SCRUM-135__subtarea-SCRUM-179.patch

# 9. Tarea SCRUM-136 (Subtarea SCRUM-183)
git checkout -b SCRUM-136 SCRUM-135
git am parches-por-tarea-historia/09-RAMA-SCRUM-136__subtarea-SCRUM-183.patch

# 10. Historia SCRUM-128 (Subtarea SCRUM-153)
git checkout -b SCRUM-128 SCRUM-136
git am parches-por-tarea-historia/10-RAMA-SCRUM-128__subtarea-SCRUM-153.patch

# 11. Tarea SCRUM-59 (Subtarea SCRUM-91)
git checkout -b SCRUM-59 SCRUM-128
git am parches-por-tarea-historia/11-RAMA-SCRUM-59__subtarea-SCRUM-91.patch

# 12. Tarea SCRUM-61 (Subtarea SCRUM-96)
git checkout -b SCRUM-61 SCRUM-59
git am parches-por-tarea-historia/12-RAMA-SCRUM-61__subtarea-SCRUM-96.patch

# 13. Tarea SCRUM-190 (Subtarea SCRUM-194)
git checkout -b SCRUM-190 SCRUM-61
git am parches-por-tarea-historia/13-RAMA-SCRUM-190__subtarea-SCRUM-194.patch

# 14. Tarea SCRUM-191 (Subtarea SCRUM-195)
git checkout -b SCRUM-191 SCRUM-190
git am parches-por-tarea-historia/14-RAMA-SCRUM-191__subtarea-SCRUM-195.patch

# 15. Tarea SCRUM-57 (Subtarea SCRUM-85)
git checkout -b SCRUM-57 SCRUM-191
git am parches-por-tarea-historia/15-RAMA-SCRUM-57__subtarea-SCRUM-85.patch

# 16. Tarea SCRUM-65 (Subtarea SCRUM-108)
git checkout -b SCRUM-65 SCRUM-57
git am parches-por-tarea-historia/16-RAMA-SCRUM-65__subtarea-SCRUM-108.patch
```

## 4. Subtareas de Backend del Sprint 1 en sus ramas de Historia/Tarea (SCRUM-65 / SCRUM-107)

Las subtareas de Backend siguen la misma convención: cada función se trabaja en la **rama de su Historia o Tarea** (`SCRUM-XX`) con un commit por subtarea (`tipo(SCRUM-XX/SCRUM-YY): ...`). Las ramas se encadenan a partir de `Sprint1`, por lo que cada rama contiene a la anterior y **se suben sin `--force`**: son *fast-forward* de las ramas `SCRUM-*` que ya existen en GitHub.

| Orden | Rama (Historia / Tarea) | Subtarea de Backend | Commit | PR sugerido hacia `Sprint1` |
| :--- | :--- | :--- | :--- | :--- |
| **B01** | `SCRUM-64` | `SCRUM-104` | `feat(SCRUM-64/SCRUM-104): revisar entidades, relaciones y migraciones PostgreSQL para Supabase` | `[SCRUM-64] Modelo de datos y migración PostgreSQL/Supabase (SCRUM-104)` |
| **B02** | `SCRUM-128` | `SCRUM-152` | `feat(SCRUM-128/SCRUM-152): integrar Ruff, pytest y migraciones versionadas en el Backend` | `[SCRUM-128] RNF11 Ruff, pytest y migraciones versionadas (SCRUM-152)` |
| **B03** | `SCRUM-11` | `SCRUM-26`, `SCRUM-27` | `feat(SCRUM-11/SCRUM-26): ...` y `feat(SCRUM-11/SCRUM-27): ...` | `[SCRUM-11] RF01 Autenticación JWT y validación de credenciales (SCRUM-26, SCRUM-27)` |
| **B04** | `SCRUM-12` | `SCRUM-29` | `feat(SCRUM-12/SCRUM-29): aplicar expiracion y validacion de sesion JWT` | `[SCRUM-12] RNF02 Expiración y validación de sesión (SCRUM-29)` |
| **B05** | `SCRUM-13` | `SCRUM-31`, `SCRUM-32` | `feat(SCRUM-13/SCRUM-31): ...` y `feat(SCRUM-13/SCRUM-32): ...` | `[SCRUM-13] RF02 Modelo y CRUD de pacientes (SCRUM-31, SCRUM-32)` |
| **B06** | `SCRUM-123` | `SCRUM-137` | `feat(SCRUM-123/SCRUM-137): restringir datos clinicos y archivos privados de pacientes` | `[SCRUM-123] RNF06 Datos clínicos y archivos privados (SCRUM-137)` |
| **B07** | `SCRUM-129` | `SCRUM-160` | `feat(SCRUM-129/SCRUM-160): implementar administracion de usuarios y roles` | `[SCRUM-129] RF11 Administración de usuarios y roles (SCRUM-160)` |
| **B08** | `SCRUM-135` | `SCRUM-178` | `feat(SCRUM-135/SCRUM-178): registrar auditoria de operaciones sensibles desde la capa de servicios` | `[SCRUM-135] RF17 Auditoría desde la capa de servicios (SCRUM-178)` |
| **B09** | `SCRUM-58` | `SCRUM-86` | `feat(SCRUM-58/SCRUM-86): confirmar contrato API para login y pacientes` | `[SCRUM-58] Contrato API login y pacientes (SCRUM-86)` |
| **B10** | `SCRUM-59` | `SCRUM-90` | `docs(SCRUM-59/SCRUM-90): ...` y `fix(SCRUM-59/SCRUM-90): ...` | `[SCRUM-59] Arranque de API, base de datos y migraciones (SCRUM-90)` |
| **B11** | `SCRUM-61` | `SCRUM-95` | `ci(SCRUM-61/SCRUM-95): automatizar pruebas de API del Backend en GitHub Actions` | `[SCRUM-61] CI de pruebas de API (SCRUM-95)` |
| **B12** | `SCRUM-136` | `SCRUM-182` | `docs(SCRUM-136/SCRUM-182): alinear servicios, datos y endpoints del Backend con el SRS` | `[SCRUM-136] Trazabilidad Backend con el SRS (SCRUM-182)` |
| **B13** | `SCRUM-190` | `SCRUM-193` | `docs(SCRUM-190/SCRUM-193): validar reglas, datos y servicios del Backend en el BPMN` | `[SCRUM-190] Validación BPMN del Backend (SCRUM-193)` |
| **B14** | `SCRUM-191` | `SCRUM-197` | `docs(SCRUM-191/SCRUM-197): validar campos, permisos y mensajes ...` | `[SCRUM-191] Campos, permisos y mensajes vs. modelo de datos (SCRUM-197)` |
| **B15** | `SCRUM-57` | `SCRUM-84` | `docs(SCRUM-57/SCRUM-84): registrar evidencias de API, persistencia y seguridad del Backend` | `[SCRUM-57] Evidencias del Backend (SCRUM-84)` |
| **B16** | `SCRUM-65` | `SCRUM-107` | `docs(SCRUM-65/SCRUM-107): trabajar cada funcion en rama propia y enlazar el PR` | `[SCRUM-65] Flujo Git del Backend y enlace de PR (SCRUM-107)` |

### 4.1 Trabajar una función en su rama y enlazar el PR

```bash
git fetch origin
git checkout SCRUM-13            # rama de la Historia
# ... cambios de la subtarea ...
git add Backend/
git commit -m "feat(SCRUM-13/SCRUM-32): implementar CRUD y validaciones de pacientes"
git push origin SCRUM-13
```

1. En GitHub: **Pull requests → New pull request**, con *base* `Sprint1` y *compare* `SCRUM-13`.
2. Título: `[SCRUM-13] RF02 Modelo y CRUD de pacientes (SCRUM-31, SCRUM-32)`.
3. Completa la plantilla `.github/pull_request_template.md`, indicando la subtarea de Backend.
4. Si Jira está conectado con GitHub, la clave `SCRUM-XX` en la rama, el commit y el título enlaza el PR con la incidencia automáticamente. Si no, pega la URL del PR en el campo *Development* de la subtarea.
5. Fusiona solo con los checks `ASPAR CI/CD — Backend` y `Frontend` en verde.

Como las ramas están encadenadas, fusionar el PR de `SCRUM-65` en `Sprint1` incorpora todas las subtareas de Backend. Si se prefiere revisar por partes, se fusionan en el orden B01 → B16.
