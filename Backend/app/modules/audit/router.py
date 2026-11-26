from datetime import timedelta

from fastapi import APIRouter, Depends, Query
from fastapi.responses import Response

from app.core.database import DbSession
from app.core.pagination import Pagination
from app.core.reports import (
    EXPORT_PERMISSION,
    EXPORT_RESPONSES,
    FORMAT_QUERY,
    DateRange,
    FileFormat,
    Report,
    date_range,
    day_start,
    describe,
    download,
    log_query,
)
from app.modules.audit import export
from app.modules.audit import service as audit_service
from app.modules.audit.models import AUDIT_AREAS
from app.modules.audit.schemas import AuditArea, AuditPage, AuditSummary, to_audit_out
from app.modules.auth.dependencies import CurrentUser, require_permission
from app.modules.users.models import AUDIT_READ

router = APIRouter(prefix="/api/v1/audit", tags=["Bitácora de auditoría"])
readers = require_permission(AUDIT_READ)
exporters = require_permission(AUDIT_READ, EXPORT_PERMISSION)


class Filters:
    """Filtros del registro de actividad, iguales para el listado y la descarga."""

    def __init__(
        self,
        category: str | None = None,
        severity: str | None = None,
        actor: str | None = Query(default=None, max_length=150),
        area: AuditArea | None = None,
        search: str | None = Query(
            default=None,
            max_length=120,
            description="Persona del equipo (nombre o correo) o afiliado (en el detalle)",
        ),
        days: int | None = Query(
            default=None, ge=1, le=366, description="Últimos N días (si no se indica «from»)"
        ),
        review: bool = Query(
            default=False,
            description="Solo situaciones para revisar (accesos bloqueados y aportes anulados)",
        ),
        period: DateRange = Depends(date_range),
    ):
        self.period = period
        self.labels = {
            "Área": AUDIT_AREAS[area][0] if area else None,
            "Categoría": category,
            "Severidad": severity,
            "Persona": actor,
            "Búsqueda": search,
            "Solo para revisar": "Sí" if review else None,
            "Últimos días": None if period.start else days,
        }
        date_from = day_start(period.start) if period.start else None
        date_to = day_start(period.end + timedelta(days=1)) if period.end else None
        self.values = {
            "category": category,
            "severity": severity,
            "actor": actor,
            "area": area,
            "search": search.strip() if search and search.strip() else None,
            "review": review,
            "date_from": audit_service.since(days, date_from),
            "date_to": date_to,
        }

    def described(self) -> dict[str, str]:
        return describe(self.period, self.labels)


@router.get("", response_model=AuditPage, response_model_by_alias=True)
def list_audit_events(
    db: DbSession,
    page: Pagination,
    filters: Filters = Depends(),
    current: CurrentUser = Depends(readers),
):
    result, names = audit_service.list_entries(db, page=page, **filters.values)
    log_query("Registro de actividad", filters.described(), result.total)
    return AuditPage.of(result, lambda entry: to_audit_out(entry, names))


@router.get("/summary", response_model=AuditSummary, response_model_by_alias=True)
def audit_summary(
    db: DbSession,
    days: int = Query(default=7, ge=1, le=366),
    current: CurrentUser = Depends(readers),
):
    """Esta semana (o los últimos N días): movimientos por área y situaciones para revisar."""
    return audit_service.summary(db, days)


@router.get("/export", response_class=Response, responses=EXPORT_RESPONSES)
def export_audit(
    db: DbSession,
    filters: Filters = Depends(),
    file_format: FileFormat = FORMAT_QUERY,
    current: CurrentUser = Depends(exporters),
):
    """«Descargar registro»: todos los movimientos del filtro de la pantalla."""
    entries, names = audit_service.export_entries(db, **filters.values)
    report = Report(
        "Registro de actividad", "registro-de-actividad", "SISTEMA", filters.described()
    )
    return download(db, current, report, [export.sheet(entries, names)], file_format)
