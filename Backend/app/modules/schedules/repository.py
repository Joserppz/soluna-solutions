import datetime as dt
import uuid

from sqlalchemy import func, select
from sqlalchemy.orm import Session

from app.core.pagination import PageParams, PageResult, paginate
from app.modules.inquiries.models import OPEN_STATUSES, Inquiry
from app.modules.schedules.models import Schedule


def _ordered(query):
    return query.order_by(Schedule.date, Schedule.start_time, Schedule.id)


def list_schedules(
    db: Session,
    date_from: dt.date | None,
    date_to: dt.date | None,
    statuses: tuple[str, ...] | None,
    page: PageParams,
) -> PageResult:
    query = select(Schedule)
    if date_from:
        query = query.where(Schedule.date >= date_from)
    if date_to:
        query = query.where(Schedule.date <= date_to)
    if statuses:
        query = query.where(Schedule.status.in_(statuses))
    return paginate(db, _ordered(query), page)


def list_public(
    db: Session, date_from: dt.date, date_to: dt.date, statuses: tuple[str, ...], limit: int
) -> list[Schedule]:
    query = select(Schedule).where(
        Schedule.date >= date_from, Schedule.date <= date_to, Schedule.status.in_(statuses)
    )
    return list(db.scalars(_ordered(query).limit(limit)))


def get(db: Session, schedule_id: uuid.UUID) -> Schedule | None:
    return db.get(Schedule, schedule_id)


def interested_by_schedule(db: Session, schedule_ids: list[uuid.UUID]) -> dict[uuid.UUID, int]:
    """Solicitudes «Quiero participar» abiertas de cada actividad."""
    if not schedule_ids:
        return {}
    rows = db.execute(
        select(Inquiry.schedule_id, func.count())
        .where(
            Inquiry.schedule_id.in_(schedule_ids),
            Inquiry.kind == "participar",
            Inquiry.status.in_(OPEN_STATUSES),
        )
        .group_by(Inquiry.schedule_id)
    )
    return dict(rows.all())


def add(db: Session, schedule: Schedule) -> Schedule:
    db.add(schedule)
    db.flush()
    db.refresh(schedule)
    return schedule
