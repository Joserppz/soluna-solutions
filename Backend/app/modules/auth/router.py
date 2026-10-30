from fastapi import APIRouter, Depends, Request, Response

from app.core.config import settings
from app.core.database import DbSession
from app.core.network import client_ip
from app.core.schemas import MessageResponse
from app.core.security import csrf_token_for
from app.modules.auth import service as auth_service
from app.modules.auth.cookies import clear_session_cookies, set_session_cookies
from app.modules.auth.dependencies import CurrentUser, get_current_user
from app.modules.auth.models import UserSession
from app.modules.auth.schemas import LoginRequest, SessionOut, SessionUserOut
from app.modules.users.models import User

router = APIRouter(prefix="/api/v1/auth", tags=["Autenticación"])


def session_user_out(user: User) -> SessionUserOut:
    return SessionUserOut(
        id=user.id,
        name=user.name,
        email=user.email,
        role=user.role_key,
        role_name=user.role_name,
        department=user.department,
        active=user.active,
    )


def session_out(user: User, session: UserSession, csrf_token: str) -> SessionOut:
    return SessionOut(
        user=session_user_out(user),
        expires_in=auth_service.seconds_left(session),
        idle_timeout=settings.session_idle_limit_seconds,
        csrf_token=csrf_token,
    )


@router.post("/login", response_model=SessionOut, response_model_by_alias=True)
def login(payload: LoginRequest, request: Request, response: Response, db: DbSession):
    result = auth_service.login(
        db, payload.email, payload.password, client_ip(request), request.headers.get("user-agent")
    )
    csrf = set_session_cookies(response, result.session, auth_service.seconds_left(result.session))
    return session_out(result.user, result.session, csrf)


@router.get("/me", response_model=SessionOut, response_model_by_alias=True)
def me(current: CurrentUser = Depends(get_current_user)):
    """Usuario de la sesión actual (el frontend lo consulta al cargar la página)."""
    return session_out(current.user, current.session, csrf_token_for(str(current.session.id)))


@router.post("/refresh", response_model=SessionOut, response_model_by_alias=True)
def refresh(response: Response, db: DbSession, current: CurrentUser = Depends(get_current_user)):
    session = auth_service.refresh(db, current.user, current.session, current.ip)
    csrf = set_session_cookies(response, session, auth_service.seconds_left(session))
    return session_out(current.user, session, csrf)


@router.post("/logout", response_model=MessageResponse)
def logout(response: Response, db: DbSession, current: CurrentUser = Depends(get_current_user)):
    auth_service.logout(db, current.user, current.session, current.ip)
    clear_session_cookies(response)
    return MessageResponse(message="Sesión cerrada correctamente")
