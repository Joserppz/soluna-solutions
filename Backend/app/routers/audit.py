from datetime import datetime

from fastapi import APIRouter, Depends, Query

from app.core.database import DbSession
from app.core.deps import CurrentUser, require_roles
from app.schemas.audit import AuditEventOut, to_audit_out
from app.services import audit_service

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
    current: CurrentUser = Depends(require_roles("Administrador")),
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
