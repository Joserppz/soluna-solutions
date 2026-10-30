"""DTO de la bitácora de auditoría."""

import uuid
from datetime import datetime

from app.core.schemas import CamelModel
from app.modules.audit.models import AuditLog


class AuditEventOut(CamelModel):
    id: uuid.UUID
    date: datetime
    actor: str
    actor_role: str
    category: str
    severity: str
    action: str
    detail: str
    ip_address: str | None
    # Cuántas veces se repitió el evento (intentos fallidos agrupados) y la última vez
    occurrences: int
    last_occurred_at: datetime


def to_audit_out(entry: AuditLog) -> AuditEventOut:
    return AuditEventOut(
        id=entry.id,
        date=entry.date,
        actor=entry.actor,
        actor_role=entry.actor_role,
        category=entry.category,
        severity=entry.severity,
        action=entry.action,
        detail=entry.detail,
        ip_address=entry.ip_address,
        occurrences=entry.occurrences,
        last_occurred_at=entry.last_occurred_at,
    )
