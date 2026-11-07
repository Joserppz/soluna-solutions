# Matriz de trazabilidad: requisitos, módulos, endpoints y pruebas (SCRUM-136 / SCRUM-181)

Esta matriz une cada requisito funcional (**RF-01 a RF-17**) y no funcional (**RNF-01 a RNF-11**) con:

- su historia y subtareas de Jira;
- el módulo del Backend que lo implementa;
- sus endpoints;
- las pruebas automáticas que lo verifican.

Refleja el **cierre del Sprint 2**: el Backend completo y los **bloques F1 a F6 del Frontend** (diseño base, sesión real y acceso; afiliados; equipo, permisos y registro de actividad; operación de la sede; donaciones, galería y contenido; sitio público; solicitudes, resumen y retiro del modo demo). Todas las pantallas usan la API: no queda modo demo ([ADR-008](../arquitectura/adr/ADR-008-modo-local-de-respaldo-en-frontend.md), retirada). Los requisitos RF-11 a RF-17 y RNF-06 a RNF-11 están definidos en la [adenda del SRS](../srs/SRS_ADENDA_SPRINT1.md).

| Suite | Pruebas | Cobertura | Dónde corre |
| :--- | ---: | :--- | :--- |
| Backend (pytest, PostgreSQL real) | **443** en 33 archivos | 98 % de sentencias (mínimo 70 %) | `.github/workflows/ci-backend.yml` |
| Frontend (Vitest) | **374** en 35 archivos | 92,5 % de líneas (mínimo 70 %) | `.github/workflows/ci-frontend.yml` |
| Frontend E2E (Playwright, API real de Docker) | **118** recorridos en 15 archivos | — | `npm run e2e` (local, con `docker compose`) |

**Columnas:**

- **Subtareas F / B / V:** subtareas de Frontend, Backend y verificación de cada historia en Jira (`SCRUM-n`).
- **Módulo:** carpeta `Backend/app/modules/<módulo>/` ([diagrama C3](../arquitectura/C4_Y_MODELO_ER_ACTUALIZADO.md#4-nivel-c3--componentes-de-la-api)).
- **Pruebas:** archivo y número de pruebas. Las del Backend están en `Backend/tests/`; las del Frontend, en `Frontend/src/**/__test__/` (Vitest) y `Frontend/e2e/` (Playwright).

**Estado:**

- **API:** ✅ implementado y probado.
- **Pantalla:** ✅ conectada a la API y probada (Vitest y E2E).
- **No funcionales:** ✅ verificado con pruebas automáticas o E2E · ⏳ se mide en el despliegue real (staging o producción) o necesita personas; queda en la [lista de comprobaciones manuales](#5-comprobaciones-manuales-en-staging).

## 1. Requisitos funcionales

| Req. | Historia | Subtareas F / B / V | Módulo | Endpoints `/api/v1` | Pruebas Backend | Pruebas Frontend | API | Pantalla |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- | :---: | :---: |
| **RF-01** Acceso del personal | SCRUM-11 | 66 / 26, 27 / 28 | `auth` | `POST /auth/login`, `/auth/google`, `/auth/register`, `/auth/verify-email`, `/auth/resend-verification`, `/auth/forgot-password`, `/auth/reset-password`, `/auth/change-password` | `test_auth_login.py` (9), `test_auth_credentials.py` (10), `test_accounts.py` (21), `test_security.py` (6), `test_adapters.py` (10) | `__test__/acceso.spec.ts` (22), `__test__/cuentas.spec.ts` (16), `components/widgetsExternos.spec.ts` (8), `api/session.spec.ts` (10) · E2E `acceso.spec.ts` (7), `cuentas.spec.ts` (5), `pantallas-de-acceso.spec.ts` (11) | ✅ | ✅ |
| **RF-02** Fichas y anamnesis | SCRUM-13 | 68 / 31, 32 / 69 | `patients`, `evaluations`, `documents` | `GET/POST /patients` (pestañas, actividad y orden), `GET /patients/summary`, `GET/PATCH /patients/{id}`, `…/deactivate`, `…/reactivate` (con motivo), `…/attendance`, `…/contacts*`, `…/evaluations*` (con quitar por error), `…/documents*` | `test_patients_api.py` (16), `test_patients_listing.py` (17), `test_patient_model.py` (12), `test_contacts_evaluations.py` (18) | `__test__/afiliados.spec.ts` (27), `__test__/fichaAfiliado.spec.ts` (47), `utils/patients.spec.ts` (15) · E2E `afiliados.spec.ts` (5), `ficha-afiliado.spec.ts` (6), `pantallas-completas.spec.ts` (7) | ✅ | ✅ (F2) |
| **RF-03 / RF-09 / RF-13** Inventario, reporte y movimientos | SCRUM-136, SCRUM-131 | 183 · 167 / 166 / 168 | `inventory` | `GET/POST /inventory`, `GET/PATCH /inventory/{id}`, `…/deactivate`, `GET/POST …/movements`, `GET /inventory/summary`, `GET /inventory/export` (CSV/Excel) | `test_inventory.py` (15) | `__test__/inventario.spec.ts` (12) · E2E `operacion.spec.ts` (inventario) | ✅ | ✅ (F4) |
| **RF-04 / RF-10** Actividades y agenda pública | SCRUM-16, SCRUM-19 | 74, 43 / 37, 76 / 38, 44 | `schedules` | `GET/POST /schedules`, `GET/PATCH/DELETE /schedules/{id}`, `…/publish`, `…/unpublish`, `…/cancel`, `GET /public/schedules` | `test_schedules.py` (17) | `__test__/actividades.spec.ts` (11), `utils/__test__/ops.spec.ts` (6), `sitioPublico.spec.ts` (agenda pública) · E2E `operacion.spec.ts` (actividades), `portal.spec.ts` (agenda del sitio) | ✅ | ✅ (F4 equipo, F5b sitio) |
| **RF-05** Galería multimedia | SCRUM-136 | 183 / — / — | `media` | `/media/albums*` (9), `DELETE /media/assets/{id}`, `PUT …/tags`, `GET /public/media/albums*` | `test_media.py` (31) | `__test__/galeria.spec.ts` (11), `sitioPublico.spec.ts` (álbumes públicos) · E2E `sitio.spec.ts` (galería) | ✅ | ✅ (F5a, álbumes del sitio en F5b) |
| **RF-06 / RF-14** Donaciones por canal y resumen mensual | SCRUM-136, SCRUM-132 | 183 · 170 / 169 / 171 | `donations` | `GET/POST /donations`, `GET /donations/{id}`, `…/confirm`, `…/cancel`, `GET /donations/summary?format=json\|csv\|xlsx`, `POST /public/donations/notice` | `test_donations.py` (31) | `__test__/donaciones.spec.ts` (11), `__test__/apoyo.spec.ts` (7: aviso y seguimiento) · E2E `donaciones.spec.ts` (8), `apoyo.spec.ts` (5) | ✅ | ✅ (F5a equipo, F5b «Apoya a ASPAR») |
| **RF-15** Meta pública de recaudación | SCRUM-133 | 173 / 172 / 174 | `donations` | `GET/PUT /donations/goal`, `GET /public/donations/goal` | `test_donations.py` (incluido arriba) | `__test__/donaciones.spec.ts` (meta e hitos), `apoyo.spec.ts` (meta en vivo) · E2E `donaciones.spec.ts` (ventana de la meta), `apoyo.spec.ts` | ✅ | ✅ (F5a, meta pública en F5b) |
| **RF-07 / RF-08** Contenido institucional y redes | SCRUM-136 | 183 / — / — | `institutional` | `GET /content/sections*`, `PUT …/{key}`, `POST …/{key}/publish`, `PUT /content/social-links`, `GET /public/content*` | `test_content.py` (15) | `__test__/contenido.spec.ts` (9), `sitioPublico.spec.ts` (lo publicado en el sitio) · E2E `sitio.spec.ts` (contenido y redes), `portal.spec.ts` | ✅ | ✅ (F5a, sitio en F5b) |
| **RF-11** Equipo, roles y permisos | SCRUM-129 | 161 / 160 / 162 | `users`, `roles` | `GET/POST /users`, `PATCH /users/{id}`, `…/approve`, `…/reset-password`, `GET /roles`, `PUT /roles/{key}/permissions` | `test_users_api.py` (11), `test_roles.py` (14), `test_permissions.py` (11) | `__test__/equipoPermisos.spec.ts` (25), `utils/team.spec.ts` (5), `router/guards.spec.ts` (8) · E2E `equipo-permisos.spec.ts` (8), persona invitada y cuenta pendiente (F1) | ✅ | ✅ (F3) |
| **RF-12** Asistencia | SCRUM-130 | 164 / 163 / 165 | `attendance` | `GET /schedules/{id}/attendance`, `PUT …/{patientId}`, `…/mark-all-present`, `…/newcomers`, `…/close`, `…/reopen`, `GET /attendance/monthly` | `test_attendance.py` (25), `test_patients_listing.py` (sábados del trimestre e historial) | `__test__/asistencia.spec.ts` (15), `fichaAfiliado.spec.ts` (pestaña Asistencia) · E2E `operacion.spec.ts` (asistencia, celular de 360 px) | ✅ | ✅ (F4) · asistencia de cada ficha ✅ (F2) |
| **RF-16** Contacto y preinscripciones | SCRUM-134 | 176 / 175 / 177 | `inquiries` | `POST /public/inquiries` (Turnstile y límite por IP), `GET /inquiries*`, `PATCH /inquiries/{id}`, `…/notes`, `…/patient-draft`, `…/convert-to-patient` | `test_inquiries.py` (21) | `sitioPublico.spec.ts` («Quiero participar» y contacto), `solicitudes.spec.ts` (8: pestañas, motivo, seguimiento, notas, inscribir) · E2E `portal.spec.ts`, `solicitudes.spec.ts` (del mensaje del sitio a la ficha) | ✅ | ✅ (sitio F5b, bandeja F6) |
| **RF-17** Bitácora de auditoría | SCRUM-135 | 179 / 178 / 180 | `audit` | `GET /audit` (área, persona o afiliado, días, situaciones para revisar), `GET /audit/summary`, `GET /audit/export` | `test_audit.py` (8), `test_audit_activity.py` (8) | `__test__/registroActividad.spec.ts` (13), `utils/audit.spec.ts` (6) · E2E `registro-actividad.spec.ts` (7) | ✅ | ✅ (F3) |
| Panel de inicio | — | — | `dashboard` | `GET /dashboard/summary` | `test_dashboard.py` (5) | `resumen.spec.ts` (4: bloques según el rol, «Tomar asistencia», sin actividad, error) · E2E `solicitudes.spec.ts` (resumen) | ✅ | ✅ (F6) |

**Qué cubre cada archivo de pruebas del Backend** (resumen):

- `test_accounts.py`: registro, verificación, recuperación, contraseña temporal y Google (vincular, bloquear, crear cuenta pendiente).
- `test_inventory.py`: stock nunca negativo, movimientos, baja con motivo y exportación protegida contra fórmulas.
- `test_schedules.py`: borrador, publicación y cancelación con aviso, horarios y cupos.
- `test_attendance.py`: lista, marcado, cierre y reapertura, recién llegados y resumen mensual.
- `test_media.py`: firma de subida, publicación solo con revisión y sin personas etiquetadas sin consentimiento de imagen, y borrado en Cloudinary solo después del commit.
- `test_donations.py`: conciliación con el extracto, referencia bancaria única (migración 003), meta sin datos de donantes y exportación CSV/Excel.
- `test_content.py`: borrador y publicación de secciones.
- `test_inquiries.py`: formulario público, seguimiento e inscripción como afiliado.

## 2. Requisitos no funcionales

| Req. | Historia | Subtareas F / B / V | Dónde se cumple | Pruebas y verificación | Estado |
| :--- | :--- | :--- | :--- | :--- | :---: |
| **RNF-01** Rendimiento (< 3 s con 50 usuarios) | — | — | Paginación en todos los listados (las vistas piden solo las filas que entran), índices `pg_trgm` | Se mide con una prueba de carga contra el despliegue real: en local no sirve de referencia | ⏳ staging |
| **RNF-02** Contraseñas y sesiones | SCRUM-12 | 67 / 29 / 30 | `auth`, `core/security`, tabla `sessions`, cookies HttpOnly + CSRF | `test_sessions.py` (9), `test_hardening.py` (11), `test_security.py`, `test_auth_login.py` · `api/client.spec.ts` (14), `composables/useIdleSession.spec.ts` (7, aviso a los 13 min, renovación y cierre a los 15), `components/ui.spec.ts` (aviso «¿Sigues ahí?») · E2E: inactividad con el reloj del navegador | ✅ |
| **RNF-03** Accesibilidad WCAG 2.1 AA | — | — | Pantallas del Frontend | Foco visible, modal con foco atrapado, avisos con `role=alert/status`, «Saltar al contenido» e insignias legibles por lector de pantalla (`components/ui.spec.ts`). E2E `accesibilidad.spec.ts`: en las 17 pantallas, un solo `h1`, `lang="es"`, imágenes con `alt`, cada campo, botón y enlace con nombre, sin `id` repetidos y «Saltar al contenido». Botones de 44 px o más en el celular (`operacion.spec.ts`, `portal.spec.ts`, `apoyo.spec.ts`) | ✅ (automático) · la revisión con lector de pantalla está en la lista manual |
| **RNF-04** Disponibilidad 99,5 % | — | — | Cloud Run + Supabase (ADR-014), `GET /health` y `/health/db` | `test_health.py` (2). La disponibilidad se mide con el monitoreo del despliegue real | ⏳ producción |
| **RNF-05** Cobertura ≥ 70 % | SCRUM-61 | 96 / 95 / 97 | CI con `--cov-fail-under=70` y umbral de Vitest | Backend 98 %, Frontend 92,5 % de líneas | ✅ |
| **RNF-06** Privacidad clínica | SCRUM-123 | 138 / 137 / 139 | `patients.can_view_clinical_record` (permiso + consentimiento + acceso Activo), `PatientSummaryOut` sin anamnesis, `evaluations`, `documents`, bucket privado, `CHECK` en la base | `test_patient_privacy.py` (20), `test_contacts_evaluations.py`, `test_storage_adapter.py` (3), `test_media.py` (consentimiento de imagen) · `fichaAfiliado.spec.ts` (aviso con el motivo real: rol, consentimiento, acceso suspendido o pendiente; sin acceso no se piden evaluaciones ni documentos), `router/guards.spec.ts` · E2E: Voluntariado ve «Información protegida» y Recepción sube documentos sin verlos | ✅ |
| **RNF-07** Respaldo y recuperación | SCRUM-124 | ver adenda §1.1 | `scripts/backup_db.py` (pg_dump + documentos, cifrado RSA-4096 + Fernet) y `.github/workflows/backup.yml` | `test_backup.py` (9): cifrado de ida y vuelta, clave equivocada, archivo alterado, la contraseña no queda en los argumentos, `pg_restore --list` real. Restauración completa probada en una base nueva. RPO y RTO se miden con el cron diario y una restauración cronometrada en staging | ⏳ staging |
| **RNF-08** Navegadores y pantallas | SCRUM-125 | ver adenda §1.1 | Frontend | E2E `accesibilidad.spec.ts`: las 17 pantallas (sitio, acceso y cada sección del equipo) a 360, 768, 1024, 1280, 1366, 1440 y 1920 px sin desplazamiento lateral ni dos barras a la vez. En escritorio cada pantalla del equipo entra completa en la ventana (`pantallas-completas.spec.ts`, `equipo-permisos.spec.ts`, `registro-actividad.spec.ts`, `operacion.spec.ts`, `donaciones.spec.ts`, `sitio.spec.ts`, `solicitudes.spec.ts`); en el celular la página se desplaza con el menú como panel. Las tablas pasan a tarjetas según su ancho. El sitio público entra en la primera vista (`portal.spec.ts`, `apoyo.spec.ts`) | ✅ Chromium (Chrome y Edge) · Firefox y Safari en la lista manual |
| **RNF-09** Usabilidad y manual | SCRUM-126 | ver adenda §1.1 | Frontend: textos en el lenguaje de ASPAR, errores con el motivo real y qué hacer | No se puede verificar con pruebas automáticas: necesita una sesión con el equipo de ASPAR y el manual de uso | ⏳ con ASPAR |
| **RNF-10** Galería en Cloudinary | SCRUM-127 | ver adenda §1.1 | `media` + `adapters/cloudinary.py`: subida firmada con formatos permitidos y carpeta por álbum; al borrar, el archivo se elimina también en Cloudinary | `test_media.py` (31) · `galeria.spec.ts` (subida firmada y aviso sin claves) · E2E `sitio.spec.ts` (Cloudinary simulado en el navegador) | ✅ (simulado) · claves reales y cuota en la lista manual |
| **RNF-11** Mantenibilidad | SCRUM-128 | 153 / 152 / 154 | Módulos por dominio (ADR-011), migraciones versionadas, contrato OpenAPI → TypeScript (ADR-013), Ruff, ESLint, Prettier, Dependabot, `pip-audit`, `npm audit` | `test_migrations.py` (11), `test_openapi.py` (2), `test_scripts.py` (10), `test_core.py` (26), `test_pagination.py` (9) · `api/endpoints.spec.ts` (4, todas las operaciones de `openapi.json` cubiertas), `api/index.spec.ts` (1), `npm run api:types:check` | ✅ |

**Conteo completo del Backend (443):** media 31 · donations 31 · core 26 · attendance 25 · inquiries 21 · accounts 21 · patient_privacy 20 · schedules 17 · patients_listing 17 · contacts_evaluations 18 · patients_api 16 · inventory 15 · content 15 · roles 14 · patient_model 12 · users_api 11 · permissions 11 · migrations 11 · hardening 11 · scripts 10 · auth_credentials 10 · adapters 10 · sessions 9 · pagination 9 · backup 9 · auth_login 9 · audit 8 · audit_activity 8 · security 6 · dashboard 5 · storage_adapter 3 · openapi 2 · health 2.

**Conteo completo del Frontend (374):** fichaAfiliado 47 · afiliados 27 · equipoPermisos 25 · acceso 23 · cuentas 16 · asistencia 15 · ui 15 · utils/patients 15 · api/client 14 · registroActividad 13 · inventario 12 · actividades 11 · donaciones 11 · galeria 11 · api/session 10 · contenido 9 · sitioPublico 9 · solicitudes 8 · widgetsExternos 8 · guards 8 · apoyo 7 · useIdleSession 7 · format 7 · utils/audit 6 · utils/ops 6 · stickyHeader 5 · utils/team 5 · validation 5 · resumen 4 · api/endpoints 4 · useToast 4 · sinModoDemo 2 · useFitLayout 2 · router/scroll 2 · api/index 1.

**Recorridos E2E de F1 (23):** `e2e/pantallas-de-acceso.spec.ts` (11: el ingreso entra completo y sin barra de desplazamiento en 5 tamaños de pantalla, con error, recuperación, cuenta pendiente, cambio de contraseña, crear cuenta con desplazamiento solo en el formulario y celular), `e2e/acceso.spec.ts` (7: ingreso fallido, Administración, Voluntariado, cuenta pendiente, persona invitada con contraseña temporal, inactividad, menú en el celular) y `e2e/cuentas.spec.ts` (5: registro y reenvío de confirmación, enlace vencido, recuperación, enlace de recuperación inválido, Google). Evidencia: [`EVIDENCIAS_FRONTEND_F1.md`](../evidencias/EVIDENCIAS_FRONTEND_F1.md).

**Recorridos E2E de F2 (11):** `e2e/afiliados.spec.ts` (5: pestañas con los contadores de la API, búsqueda por carnet, páginas, orden y filtro; alta con carnet repetido; Voluntariado sin alta; una sola barra a 1366×768 y 1920×1080) y `e2e/ficha-afiliado.spec.ts` (6: datos, familiares, historia clínica, evaluaciones, asistencia y documentos; baja y reactivación con motivo; una sola barra en las cinco pestañas a 1366×768 y 1920×1080; privacidad del Voluntariado; Recepción sube documentos sin verlos). Evidencia: [`EVIDENCIAS_FRONTEND_F2.md`](../evidencias/EVIDENCIAS_FRONTEND_F2.md).

**Ajuste de F2 (7):** `e2e/pantallas-completas.spec.ts` (Resumen, listado y las cinco pestañas de la ficha a 1366×768, 1280×720 y 1920×1080 sin barra de desplazamiento; el listado muestra las filas que caben; en el celular las pestañas quedan fijas). `ficha-afiliado.spec.ts` además quita una evaluación con su motivo.

**Recorridos E2E de F3 (17):** `e2e/equipo-permisos.spec.ts` (8: invitar con contraseña temporal que obliga a cambiarla; gestionar, restablecer, desactivar y reactivar; nadie se quita Administración; pendientes de aprobación; permisos por rol con confirmación de datos clínicos; Voluntariado sin acceso; tres pestañas completas a 1366×768 y 1920×1080), `e2e/registro-actividad.spec.ts` (7: búsqueda por afiliado y filtros; intento de acceso bloqueado como situación para revisar; días anteriores; descarga en Excel; Voluntariado sin acceso; registro completo a 1366×768 y 1920×1080) y `pantallas-completas.spec.ts` (2: cada lista se pide una sola vez al abrirla). Evidencia: [`EVIDENCIAS_FRONTEND_F3.md`](../evidencias/EVIDENCIAS_FRONTEND_F3.md).

**Recorridos E2E de F4 (11):** `e2e/operacion.spec.ts` (10: «+ Nueva actividad» abre una ventana, la actividad se crea como borrador, se publica y se cancela con aviso de reprogramación; la asistencia se guarda al marcar, se cierra y se reabre; anotar a una persona nueva; en el celular de 360 px los botones miden 44 px o más, van en la fila de cada persona, «Cerrar asistencia del día» queda a la vista y ni la asistencia ni el inventario se desplazan de lado; el voluntariado marca pero no ve el resumen mensual; el inventario hace alta en una ventana, cambio de cantidad con motivo, préstamo en el historial, baja con motivo y exportación; actividades (lista, mes y ventana), asistencia e inventario entran completos a 1366×768 y 1920×1080; la pantalla de registro entra completa en 880×900 con el captcha centrado), `e2e/pantallas-de-acceso.spec.ts` (crear cuenta entra completa a 1366×680 y 1024×600, en lugar de desplazar la columna del formulario) y `e2e/equipo-permisos.spec.ts` (+1: la pantalla de equipo entra completa a 1567×907; «+ Nuevo rol» abre la invitación en una ventana). Al terminar, `e2e/global-teardown.ts` borra las actividades y materiales de prueba. Evidencia: [`EVIDENCIAS_FRONTEND_F4.md`](../evidencias/EVIDENCIAS_FRONTEND_F4.md).

**Recorridos E2E de F5a (15):** `e2e/donaciones.spec.ts` (8: efectivo confirmado; QR recibido en la sede que queda por confirmar y se confirma con la referencia del extracto; anular con motivo; en especie que pasa al inventario; descarga del resumen en Excel; la lista, el panel, la ventana de registrar en sus tres canales y la de la meta entran completas a 1366×768, 1280×720 y 1920×1080) y `e2e/sitio.spec.ts` (7: un álbum nuevo nace privado, recibe una foto con Cloudinary simulado y no se publica sin la revisión de permisos; la foto con alguien sin permiso de imagen bloquea la publicación; un cambio del contenido se resalta en la vista previa y queda como borrador; un enlace de Instagram que no es el oficial no se guarda; la galería y las seis secciones del contenido entran completas a 1366×768, 1280×720 y 1920×1080). Al terminar, `e2e/global-teardown.ts` borra los aportes y álbumes de prueba. Evidencia: [`EVIDENCIAS_FRONTEND_F5A.md`](../evidencias/EVIDENCIAS_FRONTEND_F5A.md).

**Recorridos E2E de F5b (12):** `e2e/portal.spec.ts` (7: la portada y la franja de caminos entran en la primera vista a 1366×768, 1280×720 y 1920×1080; la agenda muestra el próximo encuentro, tacha la cancelada y pide el mes siguiente; «Quiero participar» envía la solicitud con la actividad; «Ser voluntario/a» lleva al formulario con ese motivo; en el celular el menú se despliega y no hay desplazamiento lateral) y `e2e/apoyo.spec.ts` (5: solo QR bancario, con el monto elegido y la meta en vivo; el aviso queda pendiente, se sigue con su enlace y se ve confirmado cuando el equipo lo confirma; en el celular los montos van de a dos y «Donar con QR» queda a la vista; donación en especie; «Quiero ayudar» abre `/apoyar`). El QR y Turnstile se reemplazan en el navegador; las solicitudes y avisos de prueba se borran al terminar. Evidencia: [`EVIDENCIAS_FRONTEND_F5B.md`](../evidencias/EVIDENCIAS_FRONTEND_F5B.md).

**Recorridos E2E de F6 (22):** `e2e/solicitudes.spec.ts` (6: del mensaje del sitio a la ficha, con seguimiento, nota de la llamada que la marca como contactada e «Inscribir como afiliado»; el resumen con sus cuatro contadores que llevan a cada lista; «Tomar asistencia» abre el día del próximo encuentro; el resumen y la bandeja entran completos a 1366×768, 1280×720 y 1920×1080) y `e2e/accesibilidad.spec.ts` (16: el sitio, el acceso y cada sección del equipo a siete tamaños, de 360 a 1920 px, sin desplazamiento lateral ni dos barras; lo básico de accesibilidad en cada pantalla). Al terminar se borran también los afiliados de prueba con nombre fijo de F2 y F4. Evidencia: [`EVIDENCIAS_FRONTEND_F6.md`](../evidencias/EVIDENCIAS_FRONTEND_F6.md).

## 3. Tareas técnicas y su evidencia

| Tarea | Subtareas F / B / V | Evidencia vigente |
| :--- | :--- | :--- |
| SCRUM-57 Aceptación y evidencias | 85 / 84 / 83 | `docs/evidencias/` (Sprint 1), esta matriz y el CI del Sprint 2 |
| SCRUM-58 Integración Frontend–Backend | 87 / 86 / 88 | [`CONTRATO_API_LOGIN_PACIENTES.md`](../api/CONTRATO_API_LOGIN_PACIENTES.md), `Frontend/src/api/`, `openapi.json` |
| SCRUM-59 README y `.env.example` | 91 / 90 / 89 | `README.md`, `Frontend/README.md`, `Backend/README.md`, `*/.env.example` |
| SCRUM-61 CI/CD | 96 / 95 / 97 | `.github/workflows/` (CI, respaldo), `.github/dependabot.yml`, [ADR-014](../arquitectura/adr/ADR-014-despliegue-y-operacion.md) |
| SCRUM-64 C4, datos y migraciones | 105 / 104 / 106 | [`C4_Y_MODELO_ER_ACTUALIZADO.md`](../arquitectura/C4_Y_MODELO_ER_ACTUALIZADO.md), [`MODELO_DATOS_Y_CONTRATOS.md`](../arquitectura/MODELO_DATOS_Y_CONTRATOS.md), `docs/arquitectura/adr/`, `Backend/migrations/` |
| SCRUM-65 Flujo de Git | 108 / 107 / 109 | `docs/git/FLUJO_GIT_Y_PULL_REQUESTS.md` |
| SCRUM-136 Trazabilidad | 183 / 182 / 181 | Esta matriz |
| SCRUM-190 BPMN 2.0 | 194 / 193 / 192 | `docs/bpmn/` |
| SCRUM-191 Wireframes | 195 / 197 / 196 | `docs/wireframes/WIREFRAMES_Y_FLUJOS_ASPAR.md` |

## 4. Qué cambió desde el Sprint 1

| Tema | Sprint 1 | Cierre del Sprint 2 |
| :--- | :--- | :--- |
| Módulos | 5 routers (auth, patients, documents, users, audit) | 16 módulos de dominio, 104 operaciones |
| Base de datos | 12 tablas, 2 migraciones | 25 tablas, migraciones 001 a 004 |
| Sesión | JWT en `Authorization: Bearer` guardado por el frontend | Cookie HttpOnly + token CSRF; validez decidida en `sessions` |
| Roles | 5 roles fijos en un `CHECK` | Roles y 17 permisos en la base, editables por Administración |
| Acceso | Solo correo y contraseña | Contraseña o Google, registro con verificación y aprobación, Turnstile |
| RNF-06 | Anamnesis oculta según el rol | Permiso + consentimiento + acceso Activo; el listado nunca lleva datos clínicos |
| Contrato | `test_contract_frontend.py` comparaba con `src/types/aspar.ts` | OpenAPI → `schema.d.ts` generado, verificado en los dos CI |
| Pruebas | 103 Backend y 65 Frontend (medición de cierre) | 443 Backend, 374 Frontend (Vitest) y 118 recorridos E2E |
| Respaldos | Sin definir | Respaldo cifrado con script y workflow, restauración probada |
| Frontend | Pantallas con datos de ejemplo en `localStorage` (modo demo) | Todas las pantallas sobre `src/api/`; sin modo demo ni datos del sistema en el navegador |

La versión anterior de esta matriz, con el detalle por pantalla del Sprint 1, queda en el historial de Git y en [`docs/evidencias/`](../evidencias/EVIDENCIAS_SPRINT1.md).

## 5. Comprobaciones manuales en staging

Todo lo que se puede probar sin credenciales reales ya está cubierto por pytest, Vitest y los recorridos E2E: en local los servicios externos se reemplazan por dobles y la API responde de verdad. Lo siguiente necesita las claves reales o el despliegue, y queda como lista para el equipo.

**Con credenciales reales**

- [ ] **Google OAuth:** con `GOOGLE_CLIENT_ID` (API) y `VITE_GOOGLE_CLIENT_ID` (Frontend) reales, «Continuar con Google» crea una cuenta pendiente, vincula una existente y rechaza una cuenta desactivada.
- [ ] **Cloudflare Turnstile:** con la clave real en `TURNSTILE_SECRET_KEY` y `VITE_TURNSTILE_SITE_KEY`, el registro, la recuperación, el contacto, «Quiero participar» y «Avísanos de tu aporte» funcionan, y el aviso «Solo para pruebas» desaparece. Sin resolver el captcha, la API rechaza el envío.
- [ ] **Resend (correo):** con `EMAIL_PROVIDER=resend` y `RESEND_API_KEY`, llegan los correos de confirmación y de recuperación, con enlaces que funcionan una sola vez y vencen.
- [ ] **Cloudinary:** con `CLOUDINARY_*`, se suben fotos y videos a un álbum, se ven en el sitio cuando se publica, y al quitarlos se borran también en Cloudinary. Revisar la alerta de cuota (RNF-10).
- [ ] **Supabase:** la base de producción con las migraciones aplicadas y el bucket privado de documentos: subir, abrir con enlace temporal y quitar un documento de una ficha, y comprobar que el Voluntariado no puede abrirlo (RNF-06).

**Con el despliegue real**

- [ ] **RNF-01 (rendimiento):** prueba de carga con 50 usuarios: el listado de afiliados, la agenda y el resumen responden en menos de 3 s.
- [ ] **RNF-04 (disponibilidad):** monitoreo de `GET /health` y `/health/db` durante un mes, con la meta de 99,5 %.
- [ ] **RNF-07 (RPO/RTO):** activar el cron diario del respaldo y cronometrar una restauración completa en una base nueva.

**Con personas**

- [ ] **RNF-03:** recorrer el sitio y el espacio del equipo con un lector de pantalla (NVDA o VoiceOver) y solo con el teclado.
- [ ] **RNF-08:** abrir las pantallas principales en Firefox y en Safari (iPhone); los E2E corren en Chromium, que cubre Chrome y Edge.
- [ ] **RNF-09:** una sesión con el equipo de ASPAR usando el sistema, y el manual de uso.
- [ ] Publicar desde «Contenido del sitio» los textos reales, el QR bancario de ASPAR, el titular, el banco y la cuenta.
