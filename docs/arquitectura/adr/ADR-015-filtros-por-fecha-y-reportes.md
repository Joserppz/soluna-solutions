# ADR-015: Filtro por rango de fechas y reportes descargables iguales en todas las pantallas

- **Estado:** Aceptada
- **Fecha:** 2026-11-26
- **Origen:** evaluación de los Sprints 1 y 2 (18 de noviembre de 2026)
- **Requisitos:** RF-02, RF-03, RF-04, RF-05, RF-06, RF-11, RF-12, RF-16, RF-17, RNF-06

## Contexto

La evaluación de los Sprints 1 y 2 señaló dos hallazgos:

- **Búsquedas filtradas:** falta el filtro por rango de fechas en cada pantalla.
- **Exportaciones:** se exporta solo la vista actual; se piden reportes completos y exportables desde cada pantalla.

El plan de mejora pide además:

- registrar qué filtros se aplican y cuántas filas se exportan;
- probar los límites de los rangos y comparar las filas exportadas con las filtradas;
- autorizar la exportación según el rol, sin exponer registros fuera del filtro del usuario.

Antes de este cambio, solo Donaciones, Actividades y el Registro de actividad aceptaban fechas, cada uno a su manera. Inventario exportaba todo sin mirar los filtros. El Registro de actividad cortaba su descarga en 5000 filas sin avisar.

## Decisión

1. **Un rango común** (`app/core/reports.py`):
   - cada listado acepta `?from=AAAA-MM-DD&to=AAAA-MM-DD`, con los dos días incluidos;
   - las columnas con hora se comparan en hora de Bolivia: desde las 00:00 del primer día hasta antes de las 00:00 del día siguiente al último;
   - un «desde» posterior a «hasta» responde 422.
2. **Fecha que se filtra en cada pantalla:**

   | Pantalla | Fecha |
   | :--- | :--- |
   | Afiliados | Registro de la ficha |
   | Inventario | Ingreso del material |
   | Actividades | Fecha de la actividad |
   | Asistencia | Fecha de la actividad |
   | Galería | Creación del álbum |
   | Donaciones | Fecha del aporte |
   | Solicitudes | Día en que llegó la solicitud |
   | Equipo | Alta de la cuenta |
   | Registro de actividad | Fecha del movimiento |

3. **Cada pantalla tiene `GET …/export?format=xlsx|pdf` con los mismos filtros de su listado.**
   - La descarga ejecuta **la misma función de consulta** del listado, sin paginar. Así el archivo trae exactamente las filas del filtro: ni solo la página que se ve, ni filas de fuera del filtro.
   - Por encima de 10 000 filas se pide acotar el filtro (422) en vez de cortar.
4. **Permiso nuevo `reports:export`** (migración 005). Descargar exige el permiso de la pantalla **y** `reports:export`.
   - Se asigna a Administración, Coordinación y Recepción; Administración lo cambia por rol desde el panel.
   - También lo exigen los resúmenes mensuales de asistencia y de donaciones.
   - Afiliados nunca exporta datos clínicos.
5. **Registro de cada consulta y descarga:**
   - cada listado con filtros escribe en el log `aspar.reports` la pantalla, el filtro en palabras y las filas;
   - cada descarga además queda en el registro de actividad («Descarga de reporte», con pantalla, filas, formato y filtro), porque saca datos del sistema.
6. **En el front, dos componentes compartidos:**
   - `DateRangeFilter`: un botón compacto con atajos («Este mes», «Últimos 30 días», «Este año»…) y un rango propio, guardado en la dirección como `?desde=&hasta=`;
   - `ExportMenu`: «Descargar» en Excel o PDF, dice cuántas filas salen y solo aparece para los roles con `reports:export`.

## Alternativas consideradas

- **Exportar en el navegador lo que ya cargó la tabla.** Es justo el hallazgo: solo se obtiene la página visible.
- **Un único endpoint genérico de reportes.** Debería conocer los filtros y permisos de cada módulo. Repetir `/export` en cada router, con la misma clase de filtros del listado, mantiene cada módulo dueño de su consulta ([ADR-011](./ADR-011-backend-por-modulos-de-dominio.md)).
- **Registrar en la bitácora cada consulta filtrada.** Llenaría el registro, que no se puede borrar. Las consultas van al log; solo las descargas van a la bitácora.

## Consecuencias

- Un listado nuevo debe ofrecer el mismo par listado/descarga: una clase de filtros con `Range`, `log_query` en el listado y `exportable` + `download` en la descarga.
- La descarga puede tardar más que una página (hasta 10 000 filas), pero nunca entrega un archivo incompleto.
- Contenido (las 7 secciones fijas del sitio) y Resumen (contadores) no son listados de registros, así que no llevan rango ni descarga.

## Evidencia

- `Backend/tests/test_reports.py`: límites de los rangos, filas exportadas = filtradas en cada pantalla, tope, permisos por rol, fórmulas neutralizadas, y lo que queda en el log y en el registro.
- `Frontend/src/__test__/reportes.spec.ts` y `Frontend/e2e/reportes.spec.ts`: el Excel y el PDF de Afiliados traen todas las filas del filtro, no solo la página.
- [Evidencia del plan de mejora](../../evidencias/EVIDENCIAS_SPRINT3_REPORTES.md).

## Actualización (27/11/2026): Excel y PDF en lugar de CSV

El CSV se quitó. Para el equipo de ASPAR era el formato más frágil: según la configuración regional de la computadora se abría en una sola columna o con las tildes rotas, y no tiene formato ni hojas. Ahora cada reporte se descarga en:

- **Excel (`.xlsx`)**, para trabajar los datos (filtrar, sumar, hacer gráficos). Trae todas las columnas.
- **PDF**, para imprimir o enviar el reporte tal cual (`app/core/pdf.py`, con fpdf2 y las fuentes estándar del PDF, que cubren el español y no dependen de fuentes del servidor). Cada página lleva la marca de ASPAR, el nombre del reporte y «Página N de M»; la primera, el filtro, las filas y quién lo descargó y cuándo. La tabla repite su encabezado en cada página y la hoja va horizontal con siete columnas o más. Los resúmenes del mes (Donaciones y Asistencia) muestran sus cifras en recuadros antes de la tabla.

Un PDF de miles de filas son cientos de páginas que nadie imprime: el PDF admite hasta **2000 filas** (`PDF_LIMIT`); por encima, la API responde 422 y pide acotar el rango o descargar en Excel, que sigue con el tope de 10 000. La migración `006_reportes_en_pdf.sql` solo cambia el texto del permiso `reports:export`.
