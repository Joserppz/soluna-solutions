from datetime import datetime

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.core.database import escape_like
from app.core.pagination import PageParams, PageResult, paginate
from app.modules.audit.models import AuditLog


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


def list_entries(
    db: Session,
    *,
    category: str | None = None,
    severity: str | None = None,
    actor: str | None = None,
    date_from: datetime | None = None,
    date_to: datetime | None = None,
    page: PageParams | None = None,
) -> PageResult:
    query = select(AuditLog).order_by(AuditLog.date.desc(), AuditLog.id.desc())
    if category:
        query = query.where(AuditLog.category == category)
    if severity:
        query = query.where(AuditLog.severity == severity)
    if actor:
        query = query.where(AuditLog.actor.ilike(f"%{escape_like(actor.strip())}%", escape="\\"))
    if date_from:
        query = query.where(AuditLog.date >= date_from)
    if date_to:
        query = query.where(AuditLog.date <= date_to)
    return paginate(db, query, page or PageParams())
