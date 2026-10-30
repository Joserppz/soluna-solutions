"""DTOs de usuarios y roles."""

import uuid
from datetime import datetime

from pydantic import Field

from app.core.schemas import CamelModel
from app.modules.users.models import User


class UserOut(CamelModel):
    id: uuid.UUID
    name: str
    email: str
    # Clave fija del rol (admin, coordination...) o null si está pendiente de aprobación
    role: str | None
    role_name: str
    department: str
    active: bool
    email_verified: bool
    must_change_password: bool
    last_login_at: datetime | None
    created_at: datetime


class UserCreated(UserOut):
    # Solo se devuelve si el Backend generó una contraseña temporal
    temporary_password: str | None = None


class UserCreate(CamelModel):
    name: str = Field(max_length=120)
    email: str = Field(max_length=150)
    role: str = Field(max_length=30)
    department: str = Field(default="General", max_length=80)
    password: str | None = Field(default=None, max_length=72)


class UserUpdate(CamelModel):
    name: str | None = Field(default=None, max_length=120)
    role: str | None = Field(default=None, max_length=30)
    active: bool | None = None
    department: str | None = Field(default=None, max_length=80)


class PasswordReset(CamelModel):
    password: str | None = Field(default=None, max_length=72)


class PasswordResetOut(CamelModel):
    message: str
    temporary_password: str | None = None


def to_user_out(user: User) -> UserOut:
    return UserOut(
        id=user.id,
        name=user.name,
        email=user.email,
        role=user.role_key,
        role_name=user.role_name,
        department=user.department,
        active=user.active,
        email_verified=user.email_verified,
        must_change_password=user.must_change_password,
        last_login_at=user.last_login_at,
        created_at=user.created_at,
    )
