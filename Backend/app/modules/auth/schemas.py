"""DTOs de autenticación."""

import re
import uuid

from pydantic import Field, field_validator

from app.core.schemas import CamelModel

EMAIL_PATTERN = re.compile(r"^[^\s@]+@[^\s@]+\.[^\s@]+$")


class LoginRequest(CamelModel):
    email: str = Field(max_length=150)
    password: str = Field(max_length=200)

    @field_validator("email")
    @classmethod
    def validate_email(cls, value: str) -> str:
        value = value.strip().lower()
        if not EMAIL_PATTERN.match(value):
            raise ValueError("ingresa un correo electrónico válido")
        return value

    @field_validator("password")
    @classmethod
    def validate_password(cls, value: str) -> str:
        if not value:
            raise ValueError("ingresa tu contraseña")
        if len(value.encode()) > 72:
            raise ValueError("la contraseña no puede superar 72 bytes")
        return value


class SessionUserOut(CamelModel):
    """Datos del usuario que inició sesión."""

    id: uuid.UUID
    name: str
    email: str
    # Clave del rol o null si la cuenta está pendiente de aprobación
    role: str | None
    role_name: str
    department: str
    active: bool


class SessionOut(CamelModel):
    """Estado de la sesión. El token viaja solo en la cookie HttpOnly aspar_session."""

    user: SessionUserOut
    # Segundos hasta que vence el token (renovar con POST /auth/refresh antes de ese plazo)
    expires_in: int
    # Segundos de inactividad que cierran la sesión
    idle_timeout: int
    # Mismo valor que la cookie aspar_csrf: enviarlo en X-CSRF-Token al modificar datos
    csrf_token: str
