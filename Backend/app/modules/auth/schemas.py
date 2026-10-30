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
    email_verified: bool
    # Contraseña temporal entregada por Administración: hay que cambiarla antes de seguir
    must_change_password: bool
    has_password: bool
    google_linked: bool


class SessionOut(CamelModel):
    """Estado de la sesión. El token viaja solo en la cookie HttpOnly aspar_session."""

    user: SessionUserOut
    # Permisos del rol (vacío si la cuenta está pendiente de aprobación): el frontend
    # decide qué menús mostrar; la API vuelve a verificarlos en cada petición
    permissions: list[str]
    # Segundos hasta que vence el token (renovar con POST /auth/refresh antes de ese plazo)
    expires_in: int
    # Segundos de inactividad que cierran la sesión
    idle_timeout: int
    # Mismo valor que la cookie aspar_csrf: enviarlo en X-CSRF-Token al modificar datos
    csrf_token: str


def _password_rule(value: str) -> str:
    if len(value.encode()) > 72:
        raise ValueError("la contraseña no puede superar 72 bytes")
    return value


class RegisterRequest(CamelModel):
    name: str = Field(max_length=120)
    email: str = Field(max_length=150)
    password: str = Field(max_length=200)
    # Token de Cloudflare Turnstile del formulario
    turnstile_token: str = Field(max_length=2048)

    _check_password = field_validator("password")(_password_rule)


class EmailRequest(CamelModel):
    email: str = Field(max_length=150)
    turnstile_token: str = Field(max_length=2048)

    @field_validator("email")
    @classmethod
    def normalize(cls, value: str) -> str:
        return value.strip().lower()


class TokenRequest(CamelModel):
    token: str = Field(min_length=20, max_length=200)


class ResetPasswordRequest(CamelModel):
    token: str = Field(min_length=20, max_length=200)
    password: str = Field(max_length=200)

    _check_password = field_validator("password")(_password_rule)


class ChangePasswordRequest(CamelModel):
    # Opcional solo para cuentas creadas con Google que aún no tienen contraseña
    current_password: str | None = Field(default=None, max_length=200)
    new_password: str = Field(max_length=200)

    _check_password = field_validator("new_password")(_password_rule)


class GoogleLoginRequest(CamelModel):
    # ID token que entrega Google Identity Services en el navegador
    credential: str = Field(min_length=20, max_length=4096)
