"""DTOs de autenticación: LoginRequestDto / LoginResponseDto de Frontend/src/types/aspar.ts."""

from pydantic import BaseModel


class LoginRequest(BaseModel):
    email: str
    password: str


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
