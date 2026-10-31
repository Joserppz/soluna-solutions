import datetime as dt
import uuid
from decimal import Decimal

from sqlalchemy import func, or_, select
from sqlalchemy.orm import Session

from app.core.database import escape_like
from app.core.pagination import PageParams, PageResult, paginate
from app.modules.donations.models import Donation, DonationGoal


def list_donations(
    db: Session,
    page: PageParams,
    status: str | None,
    channel: str | None,
    search: str | None,
    date_from: dt.date | None,
    date_to: dt.date | None,
) -> PageResult:
    query = select(Donation)
    if status:
        query = query.where(Donation.status == status)
    if channel:
        query = query.where(Donation.channel == channel)
    if search and search.strip():
        pattern = f"%{escape_like(search.strip())}%"
        query = query.where(
            or_(
                Donation.donor_name.ilike(pattern, escape="\\"),
                Donation.declared_reference.ilike(pattern, escape="\\"),
                Donation.bank_reference.ilike(pattern, escape="\\"),
            )
        )
    if date_from:
        query = query.where(Donation.date >= date_from)
    if date_to:
        query = query.where(Donation.date <= date_to)
    return paginate(
        db, query.order_by(Donation.date.desc(), Donation.created_at.desc(), Donation.id), page
    )


def get(db: Session, donation_id: uuid.UUID, lock: bool = False) -> Donation | None:
    query = select(Donation).where(Donation.id == donation_id)
    if lock:
        query = query.with_for_update().execution_options(populate_existing=True)
    return db.scalar(query)


def bank_reference_used(db: Session, reference: str, exclude: uuid.UUID) -> bool:
    return (
        db.scalar(
            select(func.count())
            .select_from(Donation)
            .where(
                func.lower(Donation.bank_reference) == reference.lower(),
                Donation.status == "confirmado",
                Donation.id != exclude,
            )
        )
        > 0
    )


def current_goal(db: Session) -> DonationGoal | None:
    """La meta vigente: la visible o, si ninguna lo está, la más reciente."""
    return db.scalar(
        select(DonationGoal).order_by(DonationGoal.visible.desc(), DonationGoal.created_at.desc())
    )


def visible_goal(db: Session) -> DonationGoal | None:
    return db.scalar(select(DonationGoal).where(DonationGoal.visible.is_(True)))


def confirmed_for_goal(db: Session, goal_id: uuid.UUID) -> tuple[Decimal, int]:
    total, count = db.execute(
        select(func.coalesce(func.sum(Donation.amount_bs), 0), func.count()).where(
            Donation.goal_id == goal_id, Donation.status == "confirmado"
        )
    ).one()
    return Decimal(total), count


def month_rows(db: Session, first: dt.date, last: dt.date) -> list[Donation]:
    return list(db.scalars(select(Donation).where(Donation.date >= first, Donation.date <= last)))
