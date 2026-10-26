"""DTOs de autenticación: LoginRequestDto / LoginResponseDto de Frontend/src/types/aspar.ts."""

import re

from pydantic import BaseModel, field_validator

EMAIL_PATTERN = re.compile(r"^[^\s@]+@[^\s@]+\.[^\s@]+$")


class LoginRequest(BaseModel):
    email: str
    password: str

    @field_validator("email")
    @classmethod
    def validate_email(cls, value: str) -> str:
        value = value.strip().lower()
        if not EMAIL_PATTERN.match(value) or len(value) > 150:
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


class UserOut(BaseModel):
    id: str
    name: str
    email: str
    role: str
    department: str
    active: bool


class LoginResponse(BaseModel):
    access_token: str
    token_type: str = "bearer"  # noqa: S105 - tipo de token OAuth2, no una contraseña
    expires_in: int
    idle_timeout: int
    user: UserOut


class VerifyResponse(BaseModel):
    valid: bool
    user: dict


class RefreshResponse(BaseModel):
    access_token: str
    token_type: str = "bearer"  # noqa: S105 - tipo de token OAuth2, no una contraseña
    expires_in: int


class MessageResponse(BaseModel):
    message: str
