"""DTOs de usuarios y roles: User de Frontend/src/types/aspar.ts."""

from pydantic import BaseModel, ConfigDict
from pydantic.alias_generators import to_camel

from app.models import User


class CamelModel(BaseModel):
    model_config = ConfigDict(alias_generator=to_camel, populate_by_name=True)


class UserOut(CamelModel):
    id: str
    name: str
    email: str
    role: str
    active: bool
    department: str
    created_at: str


class UserCreated(UserOut):
    # Solo se devuelve si el Backend generó una contraseña temporal
    temporary_password: str | None = None


class UserCreate(CamelModel):
    name: str
    email: str
    role: str
    department: str = "General"
    password: str | None = None


class UserUpdate(CamelModel):
    name: str | None = None
    role: str | None = None
    active: bool | None = None
    department: str | None = None


class PasswordReset(CamelModel):
    password: str | None = None


class PasswordResetOut(CamelModel):
    message: str
    temporary_password: str | None = None


def to_user_out(user: User) -> UserOut:
    return UserOut(
        id=user.id,
        name=user.name,
        email=user.email,
        role=user.role,
        active=user.active,
        department=user.department,
        created_at=user.created_at.isoformat(),
    )
