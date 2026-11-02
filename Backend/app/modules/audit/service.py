"""Registro de auditoría de operaciones sensibles desde la capa de servicios (RF-17)."""

from datetime import UTC, datetime, timedelta
from typing import TYPE_CHECKING

from sqlalchemy.orm import Session

from app.core.errors import ValidationError
from app.core.pagination import PageParams, PageResult
from app.modules.audit import repository as audit_repository
from app.modules.audit.models import (
    AUDIT_AREAS,
    AUDIT_CATEGORIES,
    AUDIT_SEVERITIES,
    REVIEW_ACTIONS,
    AuditLog,
)

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


# Tope de filas de una descarga: el registro se filtra por área, persona o días
EXPORT_LIMIT = 5000


def _validate(category: str | None, severity: str | None) -> None:
    if category and category not in AUDIT_CATEGORIES:
        raise ValidationError("Categoría inválida. Usa: " + ", ".join(AUDIT_CATEGORIES) + ".")
    if severity and severity not in AUDIT_SEVERITIES:
        raise ValidationError("Severidad inválida. Usa: " + ", ".join(AUDIT_SEVERITIES) + ".")


def since(days: int | None, date_from: datetime | None) -> datetime | None:
    """«Últimos N días» cuenta desde ahora; una fecha «from» explícita tiene prioridad."""
    if date_from or not days:
        return date_from
    return datetime.now(UTC) - timedelta(days=days)


def list_entries(
    db: Session,
    *,
    page: PageParams,
    category: str | None = None,
    severity: str | None = None,
    actor: str | None = None,
    area: str | None = None,
    search: str | None = None,
    review: bool = False,
    date_from: datetime | None = None,
    date_to: datetime | None = None,
) -> tuple[PageResult, dict[str, str]]:
    """Página del registro y el nombre de cada persona del equipo que aparece en ella."""
    _validate(category, severity)
    result = audit_repository.list_entries(
        db,
        page=page,
        category=category,
        severity=severity,
        actor=actor,
        area=area,
        search=search,
        review=review,
        date_from=date_from,
        date_to=date_to,
    )
    names = audit_repository.names_by_email(db, {entry.actor for entry in result.items})
    return result, names


def summary(db: Session, days: int) -> dict:
    """Movimientos por área y situaciones para revisar de los últimos ``days`` días."""
    date_from = datetime.now(UTC) - timedelta(days=days)
    by_category = audit_repository.counts_by_category(db, date_from)
    by_action = audit_repository.counts_by_review(db, date_from)
    blocked = sum(
        n for action, n in by_action.items() if REVIEW_ACTIONS[action] == "acceso_bloqueado"
    )
    cancelled = sum(
        n for action, n in by_action.items() if REVIEW_ACTIONS[action] == "aporte_anulado"
    )
    return {
        "days": days,
        "date_from": date_from,
        "areas": [
            {
                "area": area,
                "label": label,
                "count": sum(by_category.get(category, 0) for category in categories),
            }
            for area, (label, categories) in AUDIT_AREAS.items()
        ],
        "review": {
            "blocked_access": blocked,
            "cancelled_donations": cancelled,
            "total": blocked + cancelled,
        },
    }


def export_entries(
    db: Session, current: "CurrentUser", **filters
) -> tuple[list[AuditLog], dict[str, str]]:
    """Filas para descargar el registro (con el mismo filtro de la pantalla). La descarga
    también queda registrada: el registro de actividad es información sensible."""
    _validate(filters.get("category"), filters.get("severity"))
    entries = audit_repository.all_entries(db, EXPORT_LIMIT, **filters)
    audit(
        db,
        current,
        category="SISTEMA",
        action="Descarga del registro de actividad",
        detail=f"Descargó {len(entries)} movimientos del registro de actividad",
    )
    names = audit_repository.names_by_email(db, {entry.actor for entry in entries})
    return entries, names
