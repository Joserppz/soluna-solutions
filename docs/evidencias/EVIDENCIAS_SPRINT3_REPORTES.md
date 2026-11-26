# Evidencia del plan de mejora: filtros por fecha y reportes exportables (Sprint 3)

Responde al [informe de evaluación de los Sprints 1 y 2](#informe-de-evaluación) (18 de noviembre de 2026). La decisión de diseño está en [ADR-015](../arquitectura/adr/ADR-015-filtros-por-fecha-y-reportes.md).

## Informe de evaluación

| Hallazgo o plan de mejora | Qué pedía | Qué se hizo |
| :--- | :--- | :--- |
| **Búsquedas filtradas** | Filtro por rango de fechas en cada pantalla | Filtro «Fechas» con atajos y rango propio en las 9 pantallas con listados (tabla de abajo) |
| **Exportaciones** | Reportes completos y exportables desde cada pantalla, no solo la vista actual | «Descargar» en Excel o CSV en las 9 pantallas. Trae todas las filas del filtro, de todas las páginas |
| **Mejora de desarrollo** | Filtro por fechas y exportar el resultado completo | `app/core/reports.py` (API) y los componentes `DateRangeFilter` y `ExportMenu` (front), iguales en todas las pantallas |
| **Logging** | Registrar qué filtros se aplican y cuántas filas se exportan | Log `aspar.reports` con pantalla, filtro y filas en cada consulta filtrada y en cada descarga. Las descargas también quedan en el **registro de actividad** |
| **Pruebas** | Límites de los rangos de fechas; filas exportadas contra filas filtradas | `test_reports.py` (34 pruebas), `reportes.spec.ts` (Vitest, 18) y `e2e/reportes.spec.ts` (3 recorridos con la API real) |
| **Seguridad** | Exportar según el rol, sin registros fuera del filtro | Permiso nuevo `reports:export` además del permiso de la pantalla. La descarga usa la misma consulta del listado. Afiliados no exporta datos clínicos |
| **Asignar responsables en el tablero** · **Coordinación interna** | Organización del equipo | Fuera del código: se registra en Jira (ver [Pendiente del equipo](#pendiente-del-equipo)) |

## Qué fecha filtra cada pantalla y qué descarga

| Pantalla | Fecha del filtro | Descarga (`/api/v1`) | Permiso de la pantalla | Qué trae el archivo |
| :--- | :--- | :--- | :--- | :--- |
| Afiliados | Registro de la ficha | `GET /patients/export` | `patients:read` | Nombre, carnet, teléfono, zona, familiar principal, consentimiento, uso de imagen, estado, actividades de 6 meses, ficha activa o inactiva y fecha de registro. **Sin datos clínicos** |
| Inventario | Ingreso del material | `GET /inventory/export` | `inventory:manage` | La Alcaldía en su propia hoja y el resto en otra. Ahora respeta los filtros de la tabla; antes exportaba todo |
| Actividades | Fecha de la actividad (el rango se elige en «Descargar») | `GET /schedules/export` | `schedules:manage` o `attendance:write` | Fecha, horario, actividad, tipo, lugar, profesional, estado, cupos, interesados y cuántos vinieron |
| Asistencia | Fecha de la actividad (el rango se elige en «Descargar») | `GET /attendance/export` | `schedules:manage` o `attendance:write` | Cada asistencia marcada: quién, a qué actividad, cuándo y con qué nota. El resumen mensual sigue en el mismo menú |
| Galería | Creación del álbum | `GET /media/albums/export` | `media:manage` | Álbum, descripción, estado, permisos revisados, archivos y fecha |
| Donaciones | Fecha del aporte; sin rango propio, el mes elegido | `GET /donations/export` | `donations:manage` | El registro filtrado de la tabla. El resumen del mes sigue aparte |
| Solicitudes | Día en que llegó | `GET /inquiries/export` | `inquiries:manage` | Fecha, nombre, teléfono, para quién, zona, motivo, actividad, estado, quién atiende, mensaje y permiso para llamar |
| Equipo y permisos | Alta de la cuenta | `GET /users/export` | `users:manage` | Nombre, correo, rol, área, activa, correo confirmado, último ingreso y alta. **Sin contraseñas ni sesiones** |
| Registro de actividad | Fecha del movimiento (reemplaza a «Últimos N días») | `GET /audit/export` | `audit:read` | Todos los movimientos del filtro. Antes se cortaba en 5000 filas sin avisar |

En todas, descargar exige además `reports:export`. Contenido (las 7 secciones del sitio) y Resumen (contadores) no son listados de registros, por eso no llevan rango ni descarga.

## Reglas comunes

- **Los dos días se incluyen.** Las columnas con hora se cortan en hora de Bolivia: un registro de las 21:30 del último día entra, aunque en UTC ya sea el día siguiente.
- **«Desde» posterior a «hasta»:** la API responde 422 y el filtro del front no deja aplicarlo.
- **Filas exportadas = filas filtradas.** La descarga ejecuta la misma función de consulta del listado, sin paginar, con los mismos filtros (pestaña, búsqueda, estado, fechas…).
- **Tope de 10 000 filas:** por encima se pide acotar el rango o los filtros; nunca se corta en silencio.
- **Fórmulas neutralizadas:** un texto que empieza con `=`, `+`, `-` o `@` sale con un apóstrofo y no se ejecuta en Excel.
- **El rango queda en la dirección** (`?desde=&hasta=`): recargar o volver atrás lo conserva.

## Quién puede descargar

| Rol | `reports:export` | Qué puede descargar |
| :--- | :---: | :--- |
| Administración | ✅ (siempre) | Todo |
| Coordinación | ✅ | Afiliados, Inventario, Actividades, Asistencia, Galería, Donaciones y Solicitudes |
| Recepción | ✅ | Afiliados, Actividades, Asistencia, Donaciones y Solicitudes |
| Profesional | — | Nada (ve los listados) |
| Voluntariado | — | Nada (ve los listados y toma asistencia) |

Administración puede cambiar el permiso de cada rol en **Equipo y permisos → Qué puede ver cada rol**. Un intento de descarga sin permiso responde 403 y queda en el registro como «Intento de acceso restringido bloqueado».

## Lo que queda registrado

**En el log** (`aspar.reports`, JSON en Cloud Run):

```json
{"message": "Consulta filtrada de Donaciones", "report_screen": "Donaciones",
 "report_filters": {"Estado": "Confirmado"}, "report_rows": 12}
{"message": "Descarga de Donaciones", "report_screen": "Donaciones",
 "report_filters": {"Estado": "Confirmado"}, "report_rows": 12, "report_format": "csv"}
```

Un listado sin filtros no escribe nada.

**En el registro de actividad**, cada descarga, con persona, rol e IP:

> **Descarga de reporte** · Inventario: 4 filas en XLSX (Fechas: del 01/01/2026 al 26/11/2026; Origen: Donado)

## Pruebas

| Suite | Qué prueba |
| :--- | :--- |
| `Backend/tests/test_reports.py` (34) | Etiquetas y bordes del rango; 422 si «desde» > «hasta» en 6 listados; extremos incluidos en columnas de fecha (ingreso) y de fecha con hora (registro, a las 00:00, 21:30 y 23:59 de Bolivia); solo desde o solo hasta; **filas exportadas = total del listado** en 9 combinaciones de pantalla, rol y filtro, más Galería y Asistencia; la página no limita la descarga; nada de fuera del filtro; Excel con la misma cantidad; tope de 10 000; fórmulas; 7 combinaciones de rol sin permiso → 403; permiso visible en la matriz de roles; sin datos clínicos; registro y log con filtro y filas |
| `Frontend/src/__test__/reportes.spec.ts` (18) | Atajos, etiquetas, errores y dirección del rango; el componente de fechas (atajo, rango al revés, quitar, Esc); en Afiliados las fechas van a la tabla, a las pestañas y a la dirección, y la descarga lleva todo el filtro sin `limit`; un rol sin permiso no ve «Descargar»; error de tope; Inventario, Solicitudes, Donaciones (mes o rango propio), Galería, Actividades y Registro |
| `Frontend/e2e/reportes.spec.ts` (3) | Con la API real: el CSV de Afiliados de «Este año» tiene tantas filas como el total del filtro, aunque la tabla muestre una página; un rango sin datos no deja descargar; la descarga de Inventario queda en el registro con su filtro y sus filas |

## Pendiente del equipo

- **Asignar responsables en el tablero de Jira:** una historia por pantalla de este plan, cada una con su responsable, para mostrar en la siguiente revisión quién hizo qué.
- **Coordinación interna:** acordar en la planificación del Sprint 3 la revisión cruzada de cada pantalla (filtro, descarga y permiso) antes de cerrarla.
