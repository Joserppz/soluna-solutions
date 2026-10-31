from sqlalchemy import func, select
from sqlalchemy.orm import Session

from app.modules.users.models import Permission, User


def list_permissions(db: Session) -> list[Permission]:
    return list(db.scalars(select(Permission).order_by(Permission.key)))


def active_members_by_role(db: Session) -> dict:
    rows = db.execute(
        select(User.role_id, func.count())
        .where(User.active.is_(True), User.role_id.is_not(None))
        .group_by(User.role_id)
    )
    return dict(rows.all())
