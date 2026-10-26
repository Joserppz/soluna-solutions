# Wireframes y Flujos de Pantallas Principales — Portal Público y Panel Administrativo (SCRUM-191 / SCRUM-195)

Este documento entrega los wireframes estructurales identificables y el mapa de navegación del sistema web de **ASPAR**, cubriendo tanto el **Portal Público** como el **Panel Administrativo y Clínico**.

## 1. Wireframe del Portal Público (`/`)

![Wireframe del Portal Público ASPAR](./wireframe_portal_publico.png)

### Componentes y Flujos del Portal Público
- **Cabecera Institucional (`topbar`)**: Identidad visual de ASPAR, acceso directo al cronograma y botón de acceso administrativo (`/login`).
- **Hero Institucional y Redes Sociales (RF-07, RF-08)**: Misión de la fundación inspirada en el modelo de la Corporación CETRAM (Chile) y botones de redirección directa a **Facebook**, **Instagram** y **TikTok**.
- **Cronograma Público de Actividades Sabatinas (RF-04, RF-10)**: Tarjetas ordenadas cronológicamente con fecha, hora, especialidad (`Fisioterapia`, `Arteterapia`, `Fonoaudiología`), profesional a cargo, salón y cupos disponibles.
- **Galería Multimedia en Cloud Storage (RF-05)**: Visualización y carga de fotografías y videos almacenados en **Cloudinary / AWS S3** para liberar el almacenamiento de Google Drive/Gmail de la asociación.
- **Módulo de Donaciones y Afiliación (RF-06, RF-07)**: Despliegue del **Código QR Bancario Oficial** de la asociación, listado de requisitos de inscripción para nuevos pacientes y formulario de pago integrado con la pasarela **Libélula**.

## 2. Wireframe del Panel Administrativo y Clínico (`/pacientes`, `/usuarios`, `/inventario`, `/asistencia`, `/bitacora`)

![Wireframe del Panel Administrativo ASPAR](./wireframe_panel_administrativo.png)

### Componentes y Flujos del Panel Administrativo
1. **Monitor de Sesión Activa (RNF-02 / SCRUM-67)**: Indicador en tiempo real del rol activo y tiempo restante (`MM:SS`), con banner preventivo de renovación de token JWT y cierre automático tras 15 minutos de inactividad.
2. **Fichas de Pacientes, Anamnesis Digital y Consentimiento (`/pacientes` — RF-02, RNF-06 / SCRUM-68, SCRUM-138)**:
   - Formulario unificado de datos personales, contacto de emergencia/cuidador y evaluación clínica multidisciplinaria (fisioterapia, fonoaudiología y psicología).
   - Interruptor de consentimiento informado y selector de estado de acceso (`Activo`, `Pendiente`, `Revocado`) con bloqueo automático de visualización de datos sensibles cuando el consentimiento no está vigente.
3. **Gestión de Usuarios y Roles Jira (`/usuarios` — RF-11 / SCRUM-161)**:
   - Alta de personal y asignación de los 5 roles del proyecto (`Administrador`, `Coordinador`, `Profesional`, `Recepción`, `Voluntario`), unidad organizacional y activación/desactivación de cuenta.
4. **Control de Inventario Municipal y Asistencia (`/inventario` y `/asistencia` — RF-03, RF-09 / SCRUM-183)**:
   - Clasificación de materiales por origen (`Préstamo Alcaldía`, `Propio ASPAR`, `Donación`) y botones de exportación en **CSV/Excel** y **Acta PDF** para rendición ante la Alcaldía.
   - Marcación de asistencia sabatina vinculada al estado de consentimiento del paciente.
5. **Bitácora de Auditoría de Operaciones Sensibles (`/bitacora` — RF-17 / SCRUM-179)**:
   - Vista exclusiva para el rol `Administrador` con filtros por categoría (`AUTENTICACION`, `PACIENTES`, `CONSENTIMIENTO`, `USUARIOS_ROLES`, `INVENTARIO`, `DONACIONES`) y severidad (`INFO`, `WARNING`, `CRITICAL`).

## 3. Validación de Campos, Permisos y Mensajes con el Modelo de Datos (SCRUM-191 / SCRUM-197)

Se contrastó cada campo de los formularios (`v-model` de las vistas Vue) con su columna en PostgreSQL, su regla en el Backend y el mensaje que recibe el usuario.

### 3.1 Login (`LoginView.vue`)

| Campo | Columna | Regla en pantalla | Regla en Backend | Mensaje |
| :--- | :--- | :--- | :--- | :--- |
| `email` | `users.email` (único, sin distinguir mayúsculas) | Formato de correo | Formato y normalización a minúsculas | `correo electrónico: ingresa un correo electrónico válido` (422) |
| `password` | `users.password_hash` (bcrypt) | Mínimo 8 caracteres | Obligatoria, máximo 72 bytes; las nuevas contraseñas exigen 8+ caracteres con letras y números | `Correo o contraseña incorrectos, o usuario inactivo.` (401, igual al de la pantalla) |
| — | `users.locked_until` | Bloqueo local de 30 s | Bloqueo de 15 min en servidor | `Cuenta bloqueada temporalmente por N minutos...` (423) |

### 3.2 Pacientes (`PatientsView.vue`, `RegisterPatientView.vue`)

| Campo del formulario | Columna `patients` | Restricción del modelo | Quién puede editarlo | Mensaje del Backend (igual al del frontend) |
| :--- | :--- | :--- | :--- | :--- |
| `name` | `name` | `NOT NULL`, ≥ 3 caracteres | Editores | `El nombre completo debe tener al menos 3 caracteres.` |
| `ci` | `ci` | `UNIQUE`, 5–10 dígitos + extensión opcional | Editores | `La Cédula de Identidad debe contener entre 5 y 10 dígitos válidos.` / `Ya existe un paciente registrado con esa Cédula de Identidad.` (409) |
| `phone` | `phone` | 7–12 dígitos | Editores | `El teléfono debe contener entre 7 y 12 dígitos numéricos.` |
| `address` | `address` | Por defecto `La Paz, Bolivia` | Editores | — |
| `emergencyContact` | `emergency_contact` | `NOT NULL`, ≥ 3 caracteres | Editores | `El contacto de emergencia o cuidador es obligatorio.` |
| `caregiverRelation` | `caregiver_relation` | Por defecto `Familiar / Cuidador` | Editores | — |
| `consent` | `consent` + `consent_date` | Fecha automática al otorgarlo; se borra al retirarlo | Editores | — |
| `accessStatus` | `access_status` | `CHECK` (`Activo`, `Pendiente`, `Revocado`) y `Activo` ⇒ `consent` | Editores | `No se puede activar el acceso clínico sin consentimiento informado firmado (RNF-06).` |
| `diagnosis`, `stage`, `neurologistCertificate` | `diagnosis`, `stage` (`CHECK` 6 estadios), `neurologist_certificate` | Datos de admisión | Editores | `El estadio clínico (Hoehn y Yahr) no es válido.` |
| `physicalEvaluation`, `speechEvaluation`, `psychologicalEvaluation`, `medications` | `*_evaluation`, `medications` | Datos clínicos | **Solo personal clínico** | `Solo el personal clínico (Administrador, Coordinador, Profesional) puede registrar síntomas, evaluaciones y medicación (RNF-06).` (403) |
| `search`, `statusFilter` | `name`, `ci`, `access_status` | — | Todos los autenticados | Se envían como `?search=` y `?status=` |

> **Ajuste recomendado en la interfaz:** los formularios muestran los campos de evaluación a todos los roles. Para la Recepción deberían ocultarse o deshabilitarse, ya que el Backend rechazará el registro si se completan.

### 3.3 Usuarios y roles (`UsersView.vue`)

| Campo | Columna `users` | Restricción | Mensaje del Backend |
| :--- | :--- | :--- | :--- |
| `name` | `name` | ≥ 3 caracteres | `El nombre del usuario debe tener al menos 3 caracteres.` |
| `email` | `email` | Único y con formato válido | `Ingresa un correo electrónico institucional válido.` / `Ya existe un usuario con ese correo.` (409) |
| `role` | `role` | `CHECK` de los 5 roles | `Rol inválido. Usa: Administrador, Coordinador, Profesional, Recepción, Voluntario.` |
| `department` | `department` | Por defecto `General` | — |
| Activar/desactivar | `active` | Debe quedar un Administrador activo; nadie se desactiva a sí mismo | `Debe quedar al menos un Administrador activo.` / `No puedes quitarte el rol de Administrador...` (409) |
| — (contraseña) | `password_hash` | El formulario no la pide | El Backend genera una temporal y la devuelve en `temporaryPassword`; **la pantalla debe mostrarla una vez**. |

**Permiso:** solo `Administrador` (el router del frontend ya usa `adminOnly`; el Backend responde 403 y lo registra en la bitácora).

### 3.4 Bitácora (`AuditView.vue`)

| Filtro | Columna `audit_logs` | Valores válidos | Parámetro API |
| :--- | :--- | :--- | :--- |
| `categoryFilter` | `category` | `AUTENTICACION`, `PACIENTES`, `CONSENTIMIENTO`, `USUARIOS_ROLES`, `INVENTARIO`, `CRONOGRAMA`, `DONACIONES`, `SISTEMA` | `?category=` |
| `severityFilter` | `severity` | `INFO`, `WARNING`, `CRITICAL` | `?severity=` |
| `search` | `actor` | Texto libre | `?actor=` |

**Permiso:** solo `Administrador`. Un valor de filtro fuera de la lista devuelve `422` con la lista de valores válidos.
