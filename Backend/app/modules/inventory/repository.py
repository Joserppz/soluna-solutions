import uuid

from sqlalchemy import func, or_, select
from sqlalchemy.orm import Session

from app.core.database import escape_like
from app.core.pagination import PageParams, PageResult, paginate
from app.modules.inventory.models import InventoryItem, InventoryMovement
from app.modules.users.models import User


def _filtered(
    search: str | None,
    origin: str | None,
    category: str | None,
    condition: str | None,
    include_inactive: bool,
):
    query = select(InventoryItem)
    if not include_inactive:
        query = query.where(InventoryItem.deleted_at.is_(None))
    if search and search.strip():
        pattern = f"%{escape_like(search.strip())}%"
        query = query.where(
            or_(
                InventoryItem.name.ilike(pattern, escape="\\"),
                InventoryItem.code.ilike(pattern, escape="\\"),
                InventoryItem.donor_or_institution.ilike(pattern, escape="\\"),
            )
        )
    if origin:
        query = query.where(InventoryItem.origin == origin)
    if category:
        query = query.where(InventoryItem.category == category)
    if condition:
        query = query.where(InventoryItem.condition == condition)
    return query.order_by(InventoryItem.name, InventoryItem.id)


def list_items(db: Session, page: PageParams, **filters) -> PageResult:
    return paginate(db, _filtered(**filters), page)


def all_active(db: Session) -> list[InventoryItem]:
    return list(
        db.scalars(
            select(InventoryItem)
            .where(InventoryItem.deleted_at.is_(None))
            .order_by(InventoryItem.origin, InventoryItem.name, InventoryItem.id)
        )
    )


def get(db: Session, item_id: uuid.UUID, lock: bool = False) -> InventoryItem | None:
    query = select(InventoryItem).where(InventoryItem.id == item_id)
    if lock:
        # El stock se recalcula con la fila bloqueada: dos préstamos a la vez no la dejan negativa
        query = query.with_for_update().execution_options(populate_existing=True)
    return db.scalar(query)


def get_by_code(db: Session, code: str) -> InventoryItem | None:
    return db.scalar(select(InventoryItem).where(func.lower(InventoryItem.code) == code.lower()))


def movements(db: Session, item_id: uuid.UUID) -> list[tuple[InventoryMovement, str | None]]:
    rows = db.execute(
        select(InventoryMovement, User.name)
        .outerjoin(User, User.id == InventoryMovement.user_id)
        .where(InventoryMovement.item_id == item_id)
        .order_by(InventoryMovement.created_at.desc(), InventoryMovement.id)
    )
    return [(movement, name) for movement, name in rows.all()]


def summary(db: Session) -> dict[str, int]:
    active = InventoryItem.deleted_at.is_(None)
    total, alcaldia, donado, propio, damaged = db.execute(
        select(
            func.count(),
            func.count().filter(InventoryItem.origin == "alcaldia"),
            func.count().filter(InventoryItem.origin == "donado"),
            func.count().filter(InventoryItem.origin == "propio"),
            func.count().filter(InventoryItem.condition == "dañado"),
        ).where(active)
    ).one()
    return {
        "total": total,
        "alcaldia": alcaldia,
        "donado": donado,
        "propio": propio,
        "damaged": damaged,
    }
