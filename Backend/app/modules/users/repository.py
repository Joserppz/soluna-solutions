import uuid

from sqlalchemy import func, select
from sqlalchemy.orm import Session

from app.modules.users.models import ADMIN, Role, User


def get_by_id(db: Session, user_id: uuid.UUID) -> User | None:
    return db.get(User, user_id)


def get_by_email(db: Session, email: str) -> User | None:
    return db.scalar(select(User).where(func.lower(User.email) == email.strip().lower()))


def list_users(db: Session) -> list[User]:
    return list(db.scalars(select(User).order_by(User.created_at, User.name)))


def get_role_by_key(db: Session, key: str) -> Role | None:
    return db.scalar(select(Role).where(Role.key == key))


def list_roles(db: Session) -> list[Role]:
    return list(db.scalars(select(Role).order_by(Role.is_system.desc(), Role.name)))


def count_active_admins(db: Session) -> int:
    return db.scalar(
        select(func.count())
        .select_from(User)
        .join(Role, User.role_id == Role.id)
        .where(Role.key == ADMIN, User.active.is_(True))
    )


def add(db: Session, user: User) -> User:
    db.add(user)
    db.flush()
    db.refresh(user)
    return user
