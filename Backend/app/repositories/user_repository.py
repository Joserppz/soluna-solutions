from sqlalchemy import func, select
from sqlalchemy.orm import Session

from app.models import User


def get_by_id(db: Session, user_id: str) -> User | None:
    return db.get(User, user_id)


def get_by_email(db: Session, email: str) -> User | None:
    return db.scalar(select(User).where(func.lower(User.email) == email.strip().lower()))


def list_users(db: Session) -> list[User]:
    return list(db.scalars(select(User).order_by(User.created_at, User.name)))


def count_active_admins(db: Session) -> int:
    return db.scalar(
        select(func.count())
        .select_from(User)
        .where(User.role == "Administrador", User.active.is_(True))
    )


def add(db: Session, user: User) -> User:
    db.add(user)
    db.flush()
    db.refresh(user)
    return user
