from datetime import datetime
from typing import Literal

from fastapi import APIRouter, Depends, Query
from fastapi.responses import Response

from app.core import clock
from app.core.database import DbSession
from app.core.pagination import Pagination
from app.core.spreadsheet import CSV_MEDIA_TYPE, XLSX_MEDIA_TYPE
from app.modules.audit import export
from app.modules.audit import service as audit_service
from app.modules.audit.schemas import AuditArea, AuditPage, AuditSummary, to_audit_out
from app.modules.auth.dependencies import CurrentUser, require_permission
from app.modules.users.models import AUDIT_READ

router = APIRouter(prefix="/api/v1/audit", tags=["Bitácora de auditoría"])
readers = require_permission(AUDIT_READ)


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
        date_from: datetime | None = Query(default=None, alias="from"),
        date_to: datetime | None = Query(default=None, alias="to"),
    ):
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


@router.get("", response_model=AuditPage, response_model_by_alias=True)
def list_audit_events(
    db: DbSession,
    page: Pagination,
    filters: Filters = Depends(),
    current: CurrentUser = Depends(readers),
):
    result, names = audit_service.list_entries(db, page=page, **filters.values)
    return AuditPage.of(result, lambda entry: to_audit_out(entry, names))


@router.get("/summary", response_model=AuditSummary, response_model_by_alias=True)
def audit_summary(
    db: DbSession,
    days: int = Query(default=7, ge=1, le=366),
    current: CurrentUser = Depends(readers),
):
    """Esta semana (o los últimos N días): movimientos por área y situaciones para revisar."""
    return audit_service.summary(db, days)


@router.get(
    "/export",
    response_class=Response,
    responses={200: {"content": {CSV_MEDIA_TYPE: {}, XLSX_MEDIA_TYPE: {}}}},
)
def export_audit(
    db: DbSession,
    filters: Filters = Depends(),
    file_format: Literal["csv", "xlsx"] = Query(default="xlsx", alias="format"),
    current: CurrentUser = Depends(readers),
):
    """«Descargar registro»: lo que muestra el filtro (hasta 5000 movimientos)."""
    entries, names = audit_service.export_entries(db, current, **filters.values)
    content = (
        export.to_csv(entries, names) if file_format == "csv" else export.to_xlsx(entries, names)
    )
    name = f"registro-de-actividad-{clock.today().isoformat()}.{file_format}"
    return Response(
        content=content,
        media_type=CSV_MEDIA_TYPE if file_format == "csv" else XLSX_MEDIA_TYPE,
        headers={"Content-Disposition": f'attachment; filename="{name}"'},
    )
