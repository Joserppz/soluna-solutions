import uuid

from sqlalchemy import func, or_, select
from sqlalchemy.orm import Session

from app.core.database import escape_like
from app.core.pagination import PageParams, PageResult, paginate
from app.modules.inquiries.models import Inquiry, InquiryNote


def list_inquiries(
    db: Session,
    page: PageParams,
    status: str | None,
    kind: str | None,
    search: str | None,
) -> PageResult:
    query = select(Inquiry)
    if status:
        query = query.where(Inquiry.status == status)
    if kind:
        query = query.where(Inquiry.kind == kind)
    if search and search.strip():
        pattern = f"%{escape_like(search.strip())}%"
        query = query.where(
            or_(
                Inquiry.name.ilike(pattern, escape="\\"),
                Inquiry.phone.ilike(pattern, escape="\\"),
                Inquiry.on_behalf_of.ilike(pattern, escape="\\"),
            )
        )
    return paginate(db, query.order_by(Inquiry.created_at.desc(), Inquiry.id), page)


def get(db: Session, inquiry_id: uuid.UUID, lock: bool = False) -> Inquiry | None:
    query = select(Inquiry).where(Inquiry.id == inquiry_id)
    if lock:
        query = query.with_for_update().execution_options(populate_existing=True)
    return db.scalar(query)


def notes(db: Session, inquiry_id: uuid.UUID) -> list[InquiryNote]:
    return list(
        db.scalars(
            select(InquiryNote)
            .where(InquiryNote.inquiry_id == inquiry_id)
            .order_by(InquiryNote.created_at, InquiryNote.id)
        )
    )


def count_by_status(db: Session) -> dict[str, int]:
    return dict(db.execute(select(Inquiry.status, func.count()).group_by(Inquiry.status)).all())
