# Modelado de Procesos BPMN 2.0 y Revisión de Pasos de Usuario en la Interfaz (SCRUM-190 / SCRUM-194)

![Diagrama BPMN 2.0 ASPAR](./diagrama_procesos_bpmn_aspar.png)

## 1. Proceso 1: Autenticación Administrativa, Gestión de Sesión y Auditoría (RF-01, RNF-02, RF-17)

| Paso BPMN | Actor / Rol | Acción del Usuario en la Interfaz Vue 3 | Ruta / Componente | Respuesta Visual y Validación del Sistema |
| :--- | :--- | :--- | :--- | :--- |
| **1.1 Inicio** | Administrador / Personal | Navega a una ruta protegida o pulsa **«Iniciar sesión»** en la barra superior. | `/login` (`LoginView.vue`) | Si intentó abrir `/pacientes` sin sesión, el router redirige a `/login?redirect=/pacientes`. |
| **1.2 Ingreso de credenciales** | Administrador / Personal | Ingresa correo institucional (`admin@aspar.org`) y contraseña (`Admin2026!`). | `LoginView.vue` | Validación reactiva en tiempo real de formato de correo y longitud mínima (`>= 8` caracteres). Tras 5 intentos erróneos se bloquea por 30 s. |
| **1.3 Verificación JWT** | Sistema / API FastAPI | Envía `POST /api/v1/auth/login` y almacena sesión con token JWT. | `services/api.ts` y `services/aspar.ts` | La barra superior muestra el badge con el rol activo y el contador regresivo (`MM:SS`). Se registra evento `INFO` en Bitácora. |
| **1.4 Compuerta de Expiración** | Sistema (`App.vue`) | Monitorea actividad cada 5 s (límite 15 min inactividad / 30 min máximo). | `App.vue` | Cuando restan `<= 2 min`, despliega el banner amarillo **«Renovar sesión»**; si expira, cierra sesión y muestra alerta roja. |

## 2. Proceso 2: Afiliación de Paciente, Consentimiento Informado y Anamnesis Digital (RF-02, RNF-06)

| Paso BPMN | Actor / Rol | Acción del Usuario en la Interfaz Vue 3 | Ruta / Componente | Respuesta Visual y Validación del Sistema |
| :--- | :--- | :--- | :--- | :--- |
| **2.1 Registro de filiación** | Recepción / Profesional / Admin | Completa nombre, CI (5-10 dígitos), teléfono (7-12 dígitos), dirección y datos del familiar/cuidador. | `/pacientes` (`PatientsView.vue`) o `/pacientes/nuevo` | Si la CI ya existe o algún campo incumple formato, muestra alerta `role="alert"` sin perder los datos ingresados. |
| **2.2 Compuerta de Consentimiento (RNF-06)** | Recepción / Admin | Marca la casilla **«Consentimiento informado recibido»** y elige estado de acceso (`Activo`, `Pendiente`, `Revocado`). | `PatientsView.vue` | **Regla de negocio verificada**: El sistema bloquea pasar a estado `Activo` si el consentimiento informado no está marcado. |
| **2.3 Registro de Anamnesis Multidisciplinaria** | Profesional / Admin | Registra diagnóstico neurológico, estadio Hoehn y Yahr y evaluaciones de fisioterapia, fonoaudiología y psicología. | `PatientsView.vue` / `RegisterPatientView.vue` | Al pulsar **«Ver anamnesis»** en el listado, si el paciente tiene consentimiento y acceso `Activo`, se despliega la ficha clínica completa; de lo contrario, se muestra el aviso de protección `🔒 RNF-06`. |
| **2.4 Marcación de Asistencia Sabatina** | Profesional / Voluntario | Marca **«Presente»** o **«Ausente»** en la actividad grupal sabatina. | `/asistencia` (`AttendanceView.vue`) | Si el paciente tiene acceso revocado o carece de consentimiento vigente, el sistema impide marcar `Presente` y notifica la restricción RNF-06. |

## 3. Proceso 3: Portal Público, Galería Cloud, Donaciones e Inventario Alcaldía (RF-03 a RF-10)

| Paso BPMN | Actor / Rol | Acción del Usuario en la Interfaz Vue 3 | Ruta / Componente | Respuesta Visual y Validación del Sistema |
| :--- | :--- | :--- | :--- | :--- |
| **3.1 Consulta Pública** | Paciente / Familiar / Visitante | Accede a la portada pública sin necesidad de iniciar sesión. | `/` (`ScheduleView.vue`) | Visualiza misión institucional (modelo CETRAM), enlaces a Facebook/Instagram/TikTok (RF-08) y el cronograma sabatino ordenado (RF-10). |
| **3.2 Donación QR / Libélula** | Donante Público | Visualiza el QR bancario oficial o completa el formulario de aporte vía **Pasarela Libélula**. | `/` (`ScheduleView.vue`) | Registra el aporte verificado en Bolivianos (Bs.), incrementa el contador de transparencia y genera evento en bitácora (RF-06). |
| **3.3 Control y Exportación de Inventario** | Administrador / Coordinador | Registra bienes (`Préstamo Alcaldía`, `Propio ASPAR`, `Donación`) y pulsa **«Exportar Excel/CSV (RF-09)»** o **«Generar Acta PDF Alcaldía»**. | `/inventario` (`InventoryView.vue`) | Descarga reporte estructurado listo para auditoría municipal y registra la operación en la bitácora administrativa. |
