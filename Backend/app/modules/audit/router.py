from datetime import datetime

from fastapi import APIRouter, Depends, Query

from app.core.database import DbSession
from app.core.pagination import Pagination
from app.modules.audit import service as audit_service
from app.modules.audit.schemas import AuditPage, to_audit_out
from app.modules.auth.dependencies import CurrentUser, require_permission
from app.modules.users.models import AUDIT_READ

router = APIRouter(prefix="/api/v1/audit", tags=["Bitácora de auditoría"])


@router.get("", response_model=AuditPage, response_model_by_alias=True)
def list_audit_events(
    db: DbSession,
    page: Pagination,
    category: str | None = None,
    severity: str | None = None,
    actor: str | None = Query(default=None, max_length=150),
    date_from: datetime | None = Query(default=None, alias="from"),
    date_to: datetime | None = Query(default=None, alias="to"),
    current: CurrentUser = Depends(require_permission(AUDIT_READ)),
):
    result = audit_service.list_entries(
        db,
        category=category,
        severity=severity,
        actor=actor,
        date_from=date_from,
        date_to=date_to,
        page=page,
    )
    return AuditPage.of(result, to_audit_out)
