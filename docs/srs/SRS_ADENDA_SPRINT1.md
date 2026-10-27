# Adenda al SRS v1.0 — Requisitos del Sprint 1 (SCRUM-128 / SCRUM-154)

El SRS v1.0 (`docs/srs/DOCUMENTO_2.pdf`) define **RF-01 a RF-10** y **RNF-01 a RNF-05**. Durante la planificación en Jira se agregaron requisitos que el SRS no recoge, y la implementación del Sprint 1 cambió algunas condiciones. Esta adenda los registra para que la trazabilidad RF/RNF → Jira → C4 → pruebas sea completa. Hasta que se publique una nueva versión del PDF, el SRS vigente es **DOCUMENTO_2.pdf + esta adenda**.

## 1. Requisitos agregados

| ID | Historia Jira | Categoría | Descripción | Métrica / criterio verificable | Prioridad | Evidencia |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| **RF-11** | SCRUM-129 | Funcional | El Administrador gestiona los usuarios del sistema y les asigna uno de los roles `Administrador`, `Coordinador`, `Profesional`, `Recepción` o `Voluntario`; puede desactivar cuentas y restablecer contraseñas. | Solo el rol Administrador accede a `/usuarios` y a `/api/v1/users` (los demás reciben 403 y queda en la bitácora); siempre queda al menos un Administrador activo. | Must | `test_users_api.py`, `UsersView.spec.ts`, `RouterPermisos.spec.ts` |
| **RF-17** | SCRUM-135 | Funcional | El sistema registra las operaciones sensibles (inicios y cierres de sesión, accesos denegados, altas y cambios de pacientes, consentimientos, usuarios y roles) y solo el Administrador las consulta, con filtros por categoría, severidad y actor. | Ningún registro se puede modificar ni borrar; `GET /audit` responde 403 a otros roles. | Must | `test_audit.py`, `AuditView.spec.ts` |
| **RNF-06** | SCRUM-123 | Seguridad / Privacidad | Los datos clínicos (anamnesis, evaluaciones, medicación y documentos) solo se muestran al personal clínico (`Administrador`, `Coordinador`, `Profesional`) y solo si el paciente tiene consentimiento informado firmado y acceso `Activo`. | La API no envía la anamnesis si no se cumplen las tres condiciones; los documentos se entregan con URL firmada de 300 s desde un bucket privado. | Must | `test_patient_privacy.py`, `PatientsView.spec.ts`, recorrido integrado (pasos 5 y 6) |
| **RNF-11** | SCRUM-128 | Mantenibilidad | El código sigue estándares automáticos y está documentado: ESLint y Prettier en el Frontend, Ruff en el Backend, migraciones versionadas, README de instalación y especificación OpenAPI publicada. | El CI falla si hay errores de lint o formato, si una prueba falla o si `docs/api/openapi.json` está desactualizado. | Should | `.github/workflows/`, `test_openapi.py`, `test_migrations.py` |

### 1.1 Requisitos definidos en Jira para los sprints siguientes

Estos requisitos ya tienen historia en Jira, pero no forman parte del Sprint 1. Se registran aquí con su título de Jira; la descripción y la métrica se completan al refinar cada historia.

| ID | Historia Jira | Título en Jira | Relación con lo existente |
| :--- | :--- | :--- | :--- |
| **RF-12** | SCRUM-130 | Asistencia | Pantalla `AttendanceView.vue` y tabla `attendance` ya existen; falta la API y el resumen mensual |
| **RF-13** | SCRUM-131 | Movimientos de inventario | Amplía RF-03: entradas, salidas e historial con cantidades transaccionales |
| **RF-14** | SCRUM-132 | Donaciones | Amplía RF-06: registro por canal y resumen mensual; tabla `donations` ya existe |
| **RF-15** | SCRUM-133 | Meta pública de recaudación | Usa el total de donaciones **confirmadas** de RF-14 sin exponer datos de los donantes |
| **RF-16** | SCRUM-134 | Contacto y preinscripciones | Formulario público con límite de solicitudes y bandeja de seguimiento |
| **RNF-07** | SCRUM-124 | Respaldo y recuperación | Respaldo automático fuera del servidor principal, con RPO/RTO medidos |
| **RNF-08** | SCRUM-125 | Compatibilidad de navegadores | Chrome, Firefox, Edge y Safari, pantallas de 360 px a 1920 px |
| **RNF-09** | SCRUM-126 | Usabilidad y manual | Prueba de usabilidad con ASPAR y manual breve con capturas |
| **RNF-10** | SCRUM-127 | Cuota de Cloudinary | La galería multimedia (RF-05) se almacena en **Cloudinary**; se controla el consumo y hay un procedimiento de contingencia. Los documentos privados de pacientes siguen en Supabase Storage (ADR-005) |

## 2. Requisitos modificados

| ID | Texto del SRS v1.0 | Cambio | Motivo |
| :--- | :--- | :--- | :--- |
| **RF-01** | Inicio de sesión «exclusivo para administradores» | El inicio de sesión es para **todo el personal** de ASPAR; lo que cada rol puede hacer lo define RF-11. | El equipo de Recepción, Profesionales y Voluntarios necesita registrar fichas y asistencia. |
| **RNF-02** | bcrypt y expiración tras **30 min de inactividad** | bcrypt costo 12; sesión **máxima de 30 min** y expiración por **15 min de inactividad**, ambas validadas en el servidor; renovación explícita; **bloqueo de 15 min tras 5 intentos fallidos**. | Historia SCRUM-12 y ADR-003 / ADR-004. Es más estricto que el texto original. |
| **RNF-05** | Cobertura ≥ 70% del backend **Node.js/Express** | Cobertura ≥ 70% del **Backend Python/FastAPI (pytest)** y también del **Frontend (Vitest)**; el CI falla por debajo del mínimo. | La arquitectura aprobada (C2) usa FastAPI, no Node.js. Medición real: Backend 96,94%, Frontend 80,30% de líneas. |
| **RNF-04** | Disponibilidad 99,5% mensual del hosting | Sin cambio de texto. El hosting de la base es Supabase (plan gratuito); el de la API y el Frontend está **pendiente de definir**. | ADR-002. |

## 3. Estado de verificación de los RNF al cierre del Sprint 1

| ID | Requisito | Estado | Observación |
| :--- | :--- | :--- | :--- |
| RNF-01 | Carga de la página pública < 3 s con 50 usuarios | ⏳ Sin verificar | Requiere despliegue y una prueba de carga (Sprint 2). |
| RNF-02 | bcrypt y expiración de sesión | ✅ Verificado | `test_security.py`, `test_sessions.py`, recorrido integrado (pasos 8 y 9). |
| RNF-03 | Accesibilidad WCAG 2.1 AA | ⏳ Sin verificar | Las pantallas usan `label`, `aria-label` y `role="alert"`, pero no se hizo una auditoría de accesibilidad. |
| RNF-04 | Disponibilidad 99,5% | ⏳ Sin verificar | Depende del hosting, todavía no definido. |
| RNF-05 | Cobertura ≥ 70% | ✅ Verificado | `docs/evidencias/EVIDENCIAS_CI_Y_COBERTURA_SPRINT1.md`. |
| RNF-07 a RNF-10 | Respaldo, compatibilidad, usabilidad y cuota de Cloudinary | ⏳ Planificado | Historias SCRUM-124 a SCRUM-127, en sprints siguientes. |

## 4. Documentación técnica asociada

- **OpenAPI:** [`docs/api/openapi.json`](../api/openapi.json), generado con `python -m scripts.export_openapi` desde `Backend/`. También se consulta en vivo en `http://localhost:8000/docs`.
- **Contrato con el Frontend:** [`docs/api/CONTRATO_API_LOGIN_PACIENTES.md`](../api/CONTRATO_API_LOGIN_PACIENTES.md).
- **Trazabilidad:** [`docs/trazabilidad/MATRIZ_RF01_RF17.md`](../trazabilidad/MATRIZ_RF01_RF17.md).
- **Decisiones técnicas:** [`docs/arquitectura/adr/`](../arquitectura/adr/README.md).
