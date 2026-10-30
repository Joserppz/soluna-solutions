from fastapi import APIRouter, Depends, Request, Response, status

from app.adapters.email import EmailSender, get_email_sender
from app.adapters.google import GoogleVerifier, get_google_verifier
from app.adapters.turnstile import TurnstileVerifier, get_turnstile
from app.core.config import settings
from app.core.database import DbSession
from app.core.network import client_ip
from app.core.schemas import MessageResponse
from app.core.security import csrf_token_for
from app.modules.auth import service as auth_service
from app.modules.auth.cookies import clear_session_cookies, set_session_cookies
from app.modules.auth.dependencies import CurrentUser, get_current_user
from app.modules.auth.models import UserSession
from app.modules.auth.schemas import (
    ChangePasswordRequest,
    EmailRequest,
    GoogleLoginRequest,
    LoginRequest,
    RegisterRequest,
    ResetPasswordRequest,
    SessionOut,
    SessionUserOut,
    TokenRequest,
)
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
        email_verified=user.email_verified,
        must_change_password=user.must_change_password,
        has_password=user.password_hash is not None,
        google_linked=user.google_sub is not None,
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
    return _start(response, result)


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


def _start(response: Response, result: auth_service.LoginResult) -> SessionOut:
    csrf = set_session_cookies(response, result.session, auth_service.seconds_left(result.session))
    return session_out(result.user, result.session, csrf)


@router.post("/google", response_model=SessionOut, response_model_by_alias=True)
def login_with_google(
    payload: GoogleLoginRequest,
    request: Request,
    response: Response,
    db: DbSession,
    google: GoogleVerifier = Depends(get_google_verifier),
):
    """Continuar con Google: inicia sesión o crea una cuenta pendiente de aprobación."""
    claims = google.verify(payload.credential)
    result = auth_service.login_with_google(
        db, claims, client_ip(request), request.headers.get("user-agent")
    )
    return _start(response, result)


@router.post("/register", response_model=MessageResponse, status_code=status.HTTP_202_ACCEPTED)
def register(
    payload: RegisterRequest,
    request: Request,
    db: DbSession,
    turnstile: TurnstileVerifier = Depends(get_turnstile),
    sender: EmailSender = Depends(get_email_sender),
):
    """Crea una cuenta sin rol y envía el enlace de verificación (respuesta siempre igual)."""
    ip = client_ip(request)
    auth_service.require_human(turnstile.verify(payload.turnstile_token, ip))
    auth_service.register(
        db, name=payload.name, email=payload.email, password=payload.password, ip=ip, sender=sender
    )
    return MessageResponse(message=auth_service.CHECK_INBOX)


@router.post("/verify-email", response_model=MessageResponse)
def verify_email(payload: TokenRequest, request: Request, db: DbSession):
    auth_service.verify_email(db, payload.token, client_ip(request))
    return MessageResponse(message="Tu correo quedó confirmado. Ya puedes ingresar.")


@router.post(
    "/resend-verification", response_model=MessageResponse, status_code=status.HTTP_202_ACCEPTED
)
def resend_verification(
    payload: EmailRequest,
    request: Request,
    db: DbSession,
    turnstile: TurnstileVerifier = Depends(get_turnstile),
    sender: EmailSender = Depends(get_email_sender),
):
    auth_service.require_human(turnstile.verify(payload.turnstile_token, client_ip(request)))
    auth_service.resend_verification(db, payload.email, sender)
    return MessageResponse(message=auth_service.CHECK_INBOX)


@router.post(
    "/forgot-password", response_model=MessageResponse, status_code=status.HTTP_202_ACCEPTED
)
def forgot_password(
    payload: EmailRequest,
    request: Request,
    db: DbSession,
    turnstile: TurnstileVerifier = Depends(get_turnstile),
    sender: EmailSender = Depends(get_email_sender),
):
    ip = client_ip(request)
    auth_service.require_human(turnstile.verify(payload.turnstile_token, ip))
    auth_service.forgot_password(db, payload.email, ip, sender)
    return MessageResponse(message=auth_service.CHECK_INBOX)


@router.post("/reset-password", response_model=MessageResponse)
def reset_password(payload: ResetPasswordRequest, request: Request, db: DbSession):
    auth_service.reset_password(db, payload.token, payload.password, client_ip(request))
    return MessageResponse(message="Tu contraseña se actualizó. Ya puedes ingresar.")


@router.post("/change-password", response_model=SessionOut, response_model_by_alias=True)
def change_password(
    payload: ChangePasswordRequest,
    db: DbSession,
    current: CurrentUser = Depends(get_current_user),
):
    """Cambio de la contraseña propia (también la temporal entregada por Administración)."""
    auth_service.change_password(
        db,
        current.user,
        current.session,
        payload.current_password,
        payload.new_password,
        current.ip,
    )
    return session_out(current.user, current.session, csrf_token_for(str(current.session.id)))
