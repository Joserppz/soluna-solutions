"""Registro de auditoría de operaciones sensibles desde la capa de servicios (RF-17)."""

from datetime import datetime
from typing import TYPE_CHECKING

from sqlalchemy.orm import Session

from app.core.errors import ValidationError
from app.modules.audit import repository as audit_repository
from app.modules.audit.models import AUDIT_CATEGORIES, AUDIT_SEVERITIES, AuditLog

if TYPE_CHECKING:
    from app.modules.auth.dependencies import CurrentUser


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
            actor=actor or "desconocido",
            actor_role=actor_role,
            category=category,
            severity=severity,
            action=action,
            detail=detail,
            ip_address=ip_address,
        ),
    )


def audit(
    db: Session,
    current: "CurrentUser",
    *,
    category: str,
    action: str,
    detail: str,
    severity: str = "INFO",
) -> AuditLog:
    """Registra una acción hecha por el usuario de la sesión (correo, rol e IP)."""
    return record(
        db,
        actor=current.user.email,
        actor_role=current.user.role_name,
        category=category,
        severity=severity,
        action=action,
        detail=detail,
        ip_address=current.ip,
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
        raise ValidationError("Categoría inválida. Usa: " + ", ".join(AUDIT_CATEGORIES) + ".")
    if severity and severity not in AUDIT_SEVERITIES:
        raise ValidationError("Severidad inválida. Usa: " + ", ".join(AUDIT_SEVERITIES) + ".")
    return audit_repository.list_entries(
        db,
        category=category,
        severity=severity,
        actor=actor,
        date_from=date_from,
        date_to=date_to,
        limit=limit,
    )
