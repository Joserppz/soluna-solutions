from datetime import datetime

from sqlalchemy import func, or_, select
from sqlalchemy.orm import Session

from app.core.database import escape_like
from app.core.pagination import PageParams, PageResult, paginate
from app.modules.audit.models import AUDIT_AREAS, REVIEW_ACTIONS, AuditLog
from app.modules.users.models import User


def add(db: Session, entry: AuditLog) -> AuditLog:
    db.add(entry)
    db.flush()
    db.refresh(entry)
    return entry


def latest_in_group(db: Session, group_key: str, since: datetime) -> AuditLog | None:
    return db.scalar(
        select(AuditLog)
        .where(AuditLog.group_key == group_key, AuditLog.last_occurred_at >= since)
        .order_by(AuditLog.last_occurred_at.desc())
        .limit(1)
        .with_for_update()
    )


def _filtered(
    query,
    *,
    category: str | None = None,
    severity: str | None = None,
    actor: str | None = None,
    area: str | None = None,
    search: str | None = None,
    review: bool = False,
    date_from: datetime | None = None,
    date_to: datetime | None = None,
):
    if category:
        query = query.where(AuditLog.category == category)
    if area:
        query = query.where(AuditLog.category.in_(AUDIT_AREAS[area][1]))
    if severity:
        query = query.where(AuditLog.severity == severity)
    if actor:
        query = query.where(AuditLog.actor.ilike(f"%{escape_like(actor.strip())}%", escape="\\"))
    if search:
        # Persona del equipo (correo o nombre) o afiliado (aparece en el detalle)
        pattern = f"%{escape_like(search.strip())}%"
        team = select(func.lower(User.email)).where(User.name.ilike(pattern, escape="\\"))
        query = query.where(
            or_(
                AuditLog.actor.ilike(pattern, escape="\\"),
                func.lower(AuditLog.actor).in_(team),
                AuditLog.detail.ilike(pattern, escape="\\"),
                AuditLog.action.ilike(pattern, escape="\\"),
            )
        )
    if review:
        query = query.where(AuditLog.action.in_(tuple(REVIEW_ACTIONS)))
    if date_from:
        query = query.where(AuditLog.date >= date_from)
    if date_to:
        query = query.where(AuditLog.date <= date_to)
    return query


def list_entries(db: Session, *, page: PageParams | None = None, **filters) -> PageResult:
    query = _filtered(select(AuditLog), **filters).order_by(
        AuditLog.date.desc(), AuditLog.id.desc()
    )
    return paginate(db, query, page or PageParams())


def all_entries(db: Session, limit: int, **filters) -> list[AuditLog]:
    """Las filas de un filtro para descargarlas (de la más reciente), con un tope."""
    query = _filtered(select(AuditLog), **filters).order_by(
        AuditLog.date.desc(), AuditLog.id.desc()
    )
    return list(db.scalars(query.limit(limit)))


def counts_by_category(db: Session, date_from: datetime) -> dict[str, int]:
    rows = db.execute(
        select(AuditLog.category, func.count())
        .where(AuditLog.date >= date_from)
        .group_by(AuditLog.category)
    )
    return dict(rows.all())


def counts_by_review(db: Session, date_from: datetime) -> dict[str, int]:
    rows = db.execute(
        select(AuditLog.action, func.count())
        .where(AuditLog.date >= date_from, AuditLog.action.in_(tuple(REVIEW_ACTIONS)))
        .group_by(AuditLog.action)
    )
    return dict(rows.all())


def names_by_email(db: Session, emails: set[str]) -> dict[str, str]:
    """Nombre de cada persona del equipo según su correo (la bitácora guarda el correo)."""
    if not emails:
        return {}
    rows = db.execute(
        select(func.lower(User.email), User.name).where(
            func.lower(User.email).in_([email.lower() for email in emails])
        )
    )
    return dict(rows.all())
