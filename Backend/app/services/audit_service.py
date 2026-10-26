"""Registro de auditoría de operaciones sensibles desde la capa de servicios (RF-17)."""

import uuid

from sqlalchemy.orm import Session

from app.core.constants import AUDIT_CATEGORIES, AUDIT_SEVERITIES
from app.models import AuditLog
from app.repositories import audit_repository


def record(
    db: Session,
    *,
    actor: str,
    actor_role: str,
    category: str,
    severity: str,
    action: str,
    detail: str,
    ip_address: str | None = None,
) -> AuditLog:
    if category not in AUDIT_CATEGORIES:
        raise ValueError(f"Categoría de auditoría inválida: {category}")
    if severity not in AUDIT_SEVERITIES:
        raise ValueError(f"Severidad de auditoría inválida: {severity}")
    return audit_repository.add(
        db,
        AuditLog(
            id=str(uuid.uuid4()),
            actor=actor or "desconocido",
            actor_role=actor_role,
            category=category,
            severity=severity,
            action=action,
            detail=detail,
            ip_address=ip_address or "127.0.0.1",
        ),
    )
