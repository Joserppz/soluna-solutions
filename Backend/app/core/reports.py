"""Filtro por rango de fechas y reportes descargables, iguales en todas las pantallas.

Cada listado acepta ``?from=AAAA-MM-DD&to=AAAA-MM-DD`` (los dos días incluidos, en hora
de Bolivia). Su descarga ``/export`` usa **la misma consulta** del listado, sin paginar:
el archivo trae exactamente las filas que cumplen el filtro, nunca solo la página que se
ve ni filas de fuera del filtro. Si son demasiadas, se pide acotar en vez de cortar.

Descargar exige el permiso del listado más ``reports:export`` (Administración lo asigna
por rol). Cada consulta filtrada y cada descarga quedan en el log (filtros y filas); las
descargas además en el registro de actividad, porque sacan datos del sistema.
"""

import datetime as dt
import logging
from collections.abc import Callable, Iterable, Sequence
from dataclasses import dataclass, field
from typing import Annotated, Any, Literal

from fastapi import Depends, Query
from fastapi.responses import Response
from sqlalchemy import DateTime, Select
from sqlalchemy.orm import Session
from sqlalchemy.sql.elements import ColumnElement

from app.core import clock
from app.core.errors import ValidationError
from app.core.pagination import PageParams, PageResult
from app.core.spreadsheet import CSV_MEDIA_TYPE, XLSX_MEDIA_TYPE, csv_bytes, safe, xlsx_bytes

logger = logging.getLogger("aspar.reports")

EXPORT_PERMISSION = "reports:export"
# Una descarga nunca se corta en silencio: por encima de este tope se pide acotar el filtro
EXPORT_LIMIT = 10_000
EXPORT_PAGE = PageParams(limit=EXPORT_LIMIT + 1, offset=0)

FileFormat = Literal["csv", "xlsx"]


@dataclass(frozen=True)
class DateRange:
    """Días desde y hasta, incluidos. Cualquiera de los dos puede faltar."""

    start: dt.date | None = None
    end: dt.date | None = None

    @property
    def active(self) -> bool:
        return self.start is not None or self.end is not None

    def label(self) -> str | None:
        if self.start and self.end:
            return f"del {self.start:%d/%m/%Y} al {self.end:%d/%m/%Y}"
        if self.start:
            return f"desde el {self.start:%d/%m/%Y}"
        if self.end:
            return f"hasta el {self.end:%d/%m/%Y}"
        return None


def date_range(
    date_from: dt.date | None = Query(
        default=None, alias="from", description="Primer día incluido (AAAA-MM-DD)"
    ),
    date_to: dt.date | None = Query(
        default=None, alias="to", description="Último día incluido (AAAA-MM-DD)"
    ),
) -> DateRange:
    if date_from and date_to and date_from > date_to:
        raise ValidationError("La fecha «desde» no puede ser posterior a la fecha «hasta».")
    return DateRange(date_from, date_to)


Range = Annotated[DateRange, Depends(date_range)]


def day_start(day: dt.date) -> dt.datetime:
    """Las 00:00 de ese día en Bolivia (las columnas con hora se guardan en UTC)."""
    return dt.datetime.combine(day, dt.time.min, tzinfo=clock.BOLIVIA)


def within(column: ColumnElement, period: DateRange) -> list[ColumnElement[bool]]:
    """Condiciones para que ``column`` caiga en el rango. Una columna de fecha compara
    días; una con hora va desde las 00:00 del primer día hasta antes de las 00:00 del día
    siguiente al último (así el último día entra completo)."""
    conditions: list[ColumnElement[bool]] = []
    if isinstance(column.type, DateTime):
        if period.start:
            conditions.append(column >= day_start(period.start))
        if period.end:
            conditions.append(column < day_start(period.end + dt.timedelta(days=1)))
        return conditions
    if period.start:
        conditions.append(column >= period.start)
    if period.end:
        conditions.append(column <= period.end)
    return conditions


def filter_range(query: Select, column: ColumnElement, period: DateRange | None) -> Select:
    if period is None or not period.active:
        return query
    return query.where(*within(column, period))


# ---------------------------------------------------------------------------
# Descargas
# ---------------------------------------------------------------------------
@dataclass
class Sheet:
    """Una hoja del archivo: título, encabezados y filas ya convertidas a texto o número."""

    title: str  # nombre de la hoja de Excel (hasta 31 caracteres)
    headers: Sequence[str]
    rows: list[Sequence[Any]] = field(default_factory=list)
    heading: str | None = None  # título del bloque en el CSV (por defecto, el de la hoja)


@dataclass
class Report:
    """Lo que describe una descarga en el log y en el registro de actividad."""

    screen: str  # «Afiliados», «Inventario»…
    filename: str  # prefijo del archivo: «afiliados» → afiliados-2026-11-26.xlsx
    audit_category: str  # categoría del registro de actividad (PACIENTES, INVENTARIO…)
    filters: dict[str, str] = field(default_factory=dict)  # filtro aplicado, legible
    severity: str = "INFO"


def exportable(result: PageResult) -> list:
    """Las filas de la consulta completa, o un error claro si pasan el tope."""
    if result.total > EXPORT_LIMIT:
        raise ValidationError(
            f"El filtro tiene {result.total} filas y una descarga admite hasta "
            f"{EXPORT_LIMIT}. Acota el rango de fechas o los filtros."
        )
    return list(result.items)


def describe(period: DateRange | None = None, values: dict[str, object] | None = None) -> dict:
    """El filtro en palabras, sin los valores vacíos: {"Fechas": "del…", "Búsqueda": "ana"}."""
    described = {
        name: str(value) for name, value in (values or {}).items() if value not in (None, "")
    }
    if period is not None and (label := period.label()):
        described = {"Fechas": label} | described
    return described


def filters_text(filters: dict[str, str]) -> str:
    return "; ".join(f"{name}: {value}" for name, value in filters.items()) or "sin filtros"


def log_query(screen: str, filters: dict[str, str], total: int) -> None:
    """Qué filtro se aplicó en un listado y cuántas filas devolvió (solo log, no bitácora)."""
    if filters:
        logger.info(
            f"Consulta filtrada de {screen}",
            extra={"report_screen": screen, "report_filters": filters, "report_rows": total},
        )


def _cell(value: object) -> object:
    if value is None:
        return ""
    if isinstance(value, str):
        return safe(value)
    if isinstance(value, dt.datetime):
        return value.astimezone(clock.BOLIVIA).strftime("%d/%m/%Y %H:%M")
    if isinstance(value, dt.date):
        return value.strftime("%d/%m/%Y")
    if isinstance(value, bool):
        return "Sí" if value else "No"
    return value


def _csv(sheets: Sequence[Sheet]) -> bytes:
    rows: list[Sequence[object]] = []
    for index, sheet in enumerate(sheets):
        if len(sheets) > 1:
            if index:
                rows.append([])
            rows.append([sheet.heading or sheet.title])
        rows.append(list(sheet.headers))
        rows.extend([_cell(value) for value in row] for row in sheet.rows)
    return csv_bytes(rows)


def _xlsx(sheets: Sequence[Sheet]) -> bytes:
    return xlsx_bytes(
        [
            (sheet.title, sheet.headers, ([_cell(value) for value in row] for row in sheet.rows))
            for sheet in sheets
        ]
    )


def download(
    db: Session,
    current,
    report: Report,
    sheets: Sequence[Sheet],
    file_format: FileFormat,
    *,
    counted: int | None = None,
) -> Response:
    """Arma el archivo, deja constancia de la descarga y responde con el adjunto.

    ``counted`` son las filas que cuenta la descarga (por defecto, las de la primera hoja):
    es el mismo número que muestra el listado con ese filtro."""
    from app.modules.audit import service as audit_service

    rows = len(sheets[0].rows) if counted is None else counted
    text = filters_text(report.filters)
    audit_service.audit(
        db,
        current,
        category=report.audit_category,
        severity=report.severity,
        action="Descarga de reporte",
        detail=f"{report.screen}: {rows} filas en {file_format.upper()} ({text})",
    )
    logger.info(
        f"Descarga de {report.screen}",
        extra={
            "report_screen": report.screen,
            "report_filters": report.filters,
            "report_rows": rows,
            "report_format": file_format,
        },
    )
    content = _csv(sheets) if file_format == "csv" else _xlsx(sheets)
    name = f"{report.filename}-{clock.today():%Y-%m-%d}.{file_format}"
    return Response(
        content=content,
        media_type=CSV_MEDIA_TYPE if file_format == "csv" else XLSX_MEDIA_TYPE,
        headers={
            "Content-Disposition": f'attachment; filename="{name}"',
            "X-Report-Rows": str(rows),
            "Access-Control-Expose-Headers": "Content-Disposition, X-Report-Rows",
        },
    )


def rows_of(items: Iterable, convert: Callable[[Any], Sequence[Any]]) -> list[Sequence[Any]]:
    return [convert(item) for item in items]


# Documentación OpenAPI común de las descargas
EXPORT_RESPONSES = {
    200: {
        "content": {CSV_MEDIA_TYPE: {}, XLSX_MEDIA_TYPE: {}},
        "description": "Archivo CSV o Excel con todas las filas que cumplen el filtro",
    }
}
FORMAT_QUERY = Query(default="xlsx", alias="format")
