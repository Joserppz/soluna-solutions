"""DTO de la bitácora de auditoría (registro de actividad, diseño pág. 19)."""

import uuid
from datetime import datetime
from typing import Literal

from app.core.pagination import Page
from app.core.schemas import CamelModel
from app.modules.audit.models import AUDIT_AREAS, CATEGORY_AREA, REVIEW_ACTIONS, AuditLog

AuditArea = Literal[tuple(AUDIT_AREAS)]
ReviewKind = Literal["acceso_bloqueado", "aporte_anulado"]


class AuditEventOut(CamelModel):
    id: uuid.UUID
    date: datetime
    actor: str
    # Nombre de la persona del equipo (la bitácora guarda su correo); None si no es una
    # cuenta del equipo (por ejemplo, un intento de ingreso con un correo desconocido)
    actor_name: str | None
    actor_role: str
    category: str
    area: AuditArea | None
    area_label: str | None
    severity: str
    action: str
    detail: str
    ip_address: str | None
    # Cuántas veces se repitió el evento (intentos fallidos agrupados) y la última vez
    occurrences: int
    last_occurred_at: datetime
    # Situación para revisar: un intento de acceso bloqueado o un aporte anulado
    review: ReviewKind | None


class AuditPage(Page[AuditEventOut]):
    """Página de la bitácora (lo más reciente primero)."""


class AreaCount(CamelModel):
    area: AuditArea
    label: str
    count: int


class ReviewCounts(CamelModel):
    blocked_access: int
    cancelled_donations: int
    total: int


class AuditSummary(CamelModel):
    """Resumen del período: movimientos por área y situaciones para revisar."""

    days: int
    date_from: datetime
    areas: list[AreaCount]
    review: ReviewCounts


def to_audit_out(entry: AuditLog, names: dict[str, str] | None = None) -> AuditEventOut:
    area = CATEGORY_AREA.get(entry.category)
    return AuditEventOut(
        id=entry.id,
        date=entry.date,
        actor=entry.actor,
        actor_name=(names or {}).get(entry.actor.lower()),
        actor_role=entry.actor_role,
        category=entry.category,
        area=area,
        area_label=AUDIT_AREAS[area][0] if area else None,
        severity=entry.severity,
        action=entry.action,
        detail=entry.detail,
        ip_address=entry.ip_address,
        occurrences=entry.occurrences,
        last_occurred_at=entry.last_occurred_at,
        review=REVIEW_ACTIONS.get(entry.action),
    )
