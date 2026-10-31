"""Registro de auditoría de operaciones sensibles desde la capa de servicios (RF-17)."""

from datetime import UTC, datetime, timedelta
from typing import TYPE_CHECKING

from sqlalchemy.orm import Session

from app.core.errors import ValidationError
from app.core.pagination import PageParams, PageResult
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
    group_key: str | None = None,
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
            group_key=group_key[:200] if group_key else None,
        ),
    )


def record_grouped(
    db: Session,
    *,
    group_key: str,
    window: timedelta,
    actor: str,
    actor_role: str,
    category: str,
    severity: str,
    action: str,
    detail: str,
    ip_address: str | None = None,
) -> AuditLog:
    """Agrupa eventos repetidos (S3): si el mismo evento ocurrió dentro de ``window``,
    suma una repetición a esa fila en vez de crear otra. Así un ataque de fuerza bruta
    no llena la bitácora, que no se puede borrar."""
    now = datetime.now(UTC)
    existing = audit_repository.latest_in_group(db, group_key, now - window)
    if existing is not None:
        existing.occurrences += 1
        existing.last_occurred_at = now
        return existing
    return record(
        db,
        actor=actor,
        actor_role=actor_role,
        category=category,
        severity=severity,
        action=action,
        detail=detail,
        ip_address=ip_address,
        group_key=group_key,
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
    page: PageParams,
) -> PageResult:
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
        page=page,
    )
