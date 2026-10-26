from datetime import datetime

from sqlalchemy import func, select
from sqlalchemy.orm import Session

from app.models import AuditLog


def add(db: Session, entry: AuditLog) -> AuditLog:
    db.add(entry)
    db.flush()
    return entry


def list_entries(
    db: Session,
    *,
    category: str | None = None,
    severity: str | None = None,
    actor: str | None = None,
    date_from: datetime | None = None,
    date_to: datetime | None = None,
    limit: int = 200,
) -> list[AuditLog]:
    query = select(AuditLog).order_by(AuditLog.date.desc()).limit(limit)
    if category:
        query = query.where(AuditLog.category == category)
    if severity:
        query = query.where(AuditLog.severity == severity)
    if actor:
        query = query.where(func.lower(AuditLog.actor).like(f"%{actor.strip().lower()}%"))
    if date_from:
        query = query.where(AuditLog.date >= date_from)
    if date_to:
        query = query.where(AuditLog.date <= date_to)
    return list(db.scalars(query))
