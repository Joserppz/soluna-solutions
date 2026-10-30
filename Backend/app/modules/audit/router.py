from datetime import datetime

from fastapi import APIRouter, Depends, Query

from app.core.database import DbSession
from app.modules.audit import service as audit_service
from app.modules.audit.schemas import AuditEventOut, to_audit_out
from app.modules.auth.dependencies import CurrentUser, require_roles
from app.modules.users.models import ADMIN

router = APIRouter(prefix="/api/v1/audit", tags=["Bitácora de auditoría"])


@router.get("", response_model=list[AuditEventOut], response_model_by_alias=True)
def list_audit_events(
    db: DbSession,
    category: str | None = None,
    severity: str | None = None,
    actor: str | None = Query(default=None, max_length=150),
    date_from: datetime | None = Query(default=None, alias="from"),
    date_to: datetime | None = Query(default=None, alias="to"),
    limit: int = Query(default=200, ge=1, le=1000),
    current: CurrentUser = Depends(require_roles(ADMIN)),
):
    entries = audit_service.list_entries(
        db,
        category=category,
        severity=severity,
        actor=actor,
        date_from=date_from,
        date_to=date_to,
        limit=limit,
    )
    return [to_audit_out(entry) for entry in entries]
