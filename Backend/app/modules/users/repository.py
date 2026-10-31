import uuid

from sqlalchemy import func, or_, select
from sqlalchemy.orm import Session

from app.core.database import escape_like
from app.core.pagination import PageParams, PageResult, paginate
from app.modules.users.models import ADMIN, Role, User


def get_by_id(db: Session, user_id: uuid.UUID) -> User | None:
    return db.get(User, user_id)


def get_by_email(db: Session, email: str) -> User | None:
    return db.scalar(select(User).where(func.lower(User.email) == email.strip().lower()))


def get_by_google_sub(db: Session, google_sub: str) -> User | None:
    return db.scalar(select(User).where(User.google_sub == google_sub))


def list_users(
    db: Session, search: str | None = None, page: PageParams | None = None
) -> PageResult:
    query = select(User).order_by(User.created_at, User.name, User.id)
    if search:
        pattern = f"%{escape_like(search.strip())}%"
        query = query.where(
            or_(User.name.ilike(pattern, escape="\\"), User.email.ilike(pattern, escape="\\"))
        )
    return paginate(db, query, page or PageParams())


def get_role_by_key(db: Session, key: str) -> Role | None:
    return db.scalar(select(Role).where(Role.key == key))


def list_roles(db: Session) -> list[Role]:
    return list(db.scalars(select(Role).order_by(Role.is_system.desc(), Role.name)))


def count_active_admins(db: Session) -> int:
    """Cuenta las cuentas de Administración activas y BLOQUEA sus filas hasta el commit.

    Si dos administradores se quitan el rol al mismo tiempo, el segundo espera al primero
    y ve el conteo real: nunca quedan los dos sin rol.
    """
    admins = db.scalars(
        select(User.id)
        .join(Role, User.role_id == Role.id)
        .where(Role.key == ADMIN, User.active.is_(True))
        .with_for_update(of=User)
    )
    return len(admins.all())


def add(db: Session, user: User) -> User:
    db.add(user)
    db.flush()
    db.refresh(user)
    return user
