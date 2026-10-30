"""Dependencias de FastAPI: usuario autenticado a partir de la cookie de sesión."""

import uuid
from dataclasses import dataclass
from datetime import UTC, datetime, timedelta

import jwt
from fastapi import Depends, Request

from app.core.config import settings
from app.core.database import DbSession
from app.core.errors import Forbidden, Unauthorized
from app.core.logging import set_current_user_id
from app.core.middleware import UNSAFE_METHODS
from app.core.network import client_ip
from app.core.security import csrf_token_matches, decode_access_token
from app.modules.audit import service as audit_service
from app.modules.auth import repository as session_repository
from app.modules.auth.cookies import CSRF_HEADER, SESSION_COOKIE
from app.modules.auth.models import UserSession
from app.modules.users import repository as user_repository
from app.modules.users.models import User

SESSION_INVALID = "Sesión inválida o expirada. Inicia sesión nuevamente."
SESSION_IDLE_EXPIRED = "La sesión expiró por inactividad (15 minutos). Inicia sesión nuevamente."
CSRF_INVALID = "Falta el token de seguridad de la sesión (X-CSRF-Token). Recarga la página."
# La actividad se guarda como mucho una vez por minuto: evita escribir en cada petición
ACTIVITY_WRITE_INTERVAL = timedelta(seconds=60)


@dataclass
class CurrentUser:
    user: User
    session: UserSession
    ip: str | None


def get_current_user(request: Request, db: DbSession) -> CurrentUser:
    token = request.cookies.get(SESSION_COOKIE)
    if not token:
        raise Unauthorized("Inicia sesión para continuar.")
    try:
        payload = decode_access_token(token)
    except jwt.PyJWTError as exc:
        raise Unauthorized(SESSION_INVALID) from exc

    try:
        session_id, user_id = uuid.UUID(payload["sid"]), uuid.UUID(payload["sub"])
    except ValueError as exc:
        raise Unauthorized(SESSION_INVALID) from exc
    session = session_repository.get_by_id(db, session_id)
    now = datetime.now(UTC)
    if (
        session is None
        or session.user_id != user_id
        or session.revoked_at is not None
        or session.expires_at <= now
        or session.absolute_expires_at <= now
    ):
        raise Unauthorized(SESSION_INVALID)
    # CSRF: toda petición que modifica datos repite el token de la cookie aspar_csrf
    if request.method in UNSAFE_METHODS and not csrf_token_matches(
        str(session.id), request.headers.get(CSRF_HEADER)
    ):
        raise Forbidden(CSRF_INVALID)
    if session.last_activity_at + timedelta(seconds=settings.session_idle_limit_seconds) <= now:
        session.revoked_at = now
        raise Unauthorized(SESSION_IDLE_EXPIRED, persist=True)

    user = user_repository.get_by_id(db, session.user_id)
    if user is None or not user.active:
        raise Unauthorized(SESSION_INVALID)

    # Cada petición autenticada cuenta como actividad (límite de inactividad RNF-02)
    if now - session.last_activity_at >= ACTIVITY_WRITE_INTERVAL:
        session.last_activity_at = now
    set_current_user_id(str(user.id))
    return CurrentUser(user=user, session=session, ip=client_ip(request))


def require_roles(*roles: str):
    """Permite el acceso solo a los roles indicados; los rechazos quedan en la bitácora."""

    def checker(
        request: Request,
        db: DbSession,
        current: CurrentUser = Depends(get_current_user),
    ) -> CurrentUser:
        if current.user.role_key not in roles:
            audit_service.audit(
                db,
                current,
                category="SISTEMA",
                severity="WARNING",
                action="Intento de acceso restringido bloqueado",
                detail=(
                    f"El rol {current.user.role_name} intentó {request.method} "
                    f"{request.url.path} (permitido para: {', '.join(roles)})"
                ),
            )
            raise Forbidden(
                f"El rol {current.user.role_name} no tiene permisos para esta operación.",
                persist=True,
            )
        return current

    return checker
