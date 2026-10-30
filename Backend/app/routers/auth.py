from fastapi import APIRouter, Depends, Request

from app.core.database import DbSession
from app.core.deps import CurrentUser, get_current_user
from app.core.network import client_ip
from app.schemas.auth import (
    LoginRequest,
    LoginResponse,
    MessageResponse,
    RefreshResponse,
    UserOut,
    VerifyResponse,
)
from app.services import auth_service

router = APIRouter(prefix="/api/v1/auth", tags=["Autenticación"])


@router.post("/login", response_model=LoginResponse)
def login(payload: LoginRequest, request: Request, db: DbSession):
    result = auth_service.login(
        db, payload.email, payload.password, client_ip(request), request.headers.get("user-agent")
    )
    return LoginResponse(
        access_token=result.access_token,
        expires_in=result.expires_in,
        idle_timeout=result.idle_timeout,
        user=UserOut.model_validate(result.user, from_attributes=True),
    )


@router.get("/verify", response_model=VerifyResponse)
def verify(current: CurrentUser = Depends(get_current_user)):
    user = current.user
    return VerifyResponse(
        valid=True,
        user={"sub": user.id, "email": user.email, "name": user.name, "role": user.role},
    )


@router.post("/refresh", response_model=RefreshResponse)
def refresh(db: DbSession, current: CurrentUser = Depends(get_current_user)):
    result = auth_service.refresh(db, current.user, current.session, current.ip)
    return RefreshResponse(access_token=result.access_token, expires_in=result.expires_in)


@router.post("/logout", response_model=MessageResponse)
def logout(db: DbSession, current: CurrentUser = Depends(get_current_user)):
    auth_service.logout(db, current.user, current.session, current.ip)
    return MessageResponse(message="Sesión cerrada correctamente")
