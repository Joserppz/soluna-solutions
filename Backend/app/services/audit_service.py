"""Registro de auditoría de operaciones sensibles desde la capa de servicios (RF-17)."""

import uuid
from datetime import datetime

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


def list_entries(
    db: Session,
    *,
    category: str | None,
    severity: str | None,
    actor: str | None,
    date_from: datetime | None,
    date_to: datetime | None,
    limit: int,
) -> list[AuditLog]:
    if category and category not in AUDIT_CATEGORIES:
        raise ValueError("Categoría inválida. Usa: " + ", ".join(AUDIT_CATEGORIES) + ".")
    if severity and severity not in AUDIT_SEVERITIES:
        raise ValueError("Severidad inválida. Usa: " + ", ".join(AUDIT_SEVERITIES) + ".")
    return audit_repository.list_entries(
        db,
        category=category,
        severity=severity,
        actor=actor,
        date_from=date_from,
        date_to=date_to,
        limit=limit,
    )
