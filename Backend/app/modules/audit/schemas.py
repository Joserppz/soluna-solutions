"""DTO de la bitácora: AuditEvent de Frontend/src/types/aspar.ts."""

from app.core.schemas import CamelModel
from app.modules.audit.models import AuditLog


class AuditEventOut(CamelModel):
    id: str
    date: str
    actor: str
    actor_role: str
    category: str
    severity: str
    action: str
    detail: str
    ip_address: str


def to_audit_out(entry: AuditLog) -> AuditEventOut:
    return AuditEventOut(
        id=entry.id,
        date=entry.date.isoformat(),
        actor=entry.actor,
        actor_role=entry.actor_role,
        category=entry.category,
        severity=entry.severity,
        action=entry.action,
        detail=entry.detail,
        ip_address=entry.ip_address,
    )
