"""Dependencias de FastAPI: usuario autenticado a partir del token Bearer."""

import uuid
from dataclasses import dataclass
from datetime import UTC, datetime, timedelta

import jwt
from fastapi import Depends, Header, Request

from app.core.config import settings
from app.core.database import DbSession
from app.core.errors import Forbidden, Unauthorized
from app.core.logging import set_current_user_id
from app.core.network import client_ip
from app.core.security import decode_access_token
from app.modules.audit import service as audit_service
from app.modules.auth import repository as session_repository
from app.modules.auth.models import UserSession
from app.modules.users import repository as user_repository
from app.modules.users.models import User

SESSION_INVALID = "Sesión inválida o expirada. Inicia sesión nuevamente."
SESSION_IDLE_EXPIRED = "La sesión expiró por inactividad (15 minutos). Inicia sesión nuevamente."
# La actividad se guarda como mucho una vez por minuto: evita escribir en cada petición
ACTIVITY_WRITE_INTERVAL = timedelta(seconds=60)


@dataclass
class CurrentUser:
    user: User
    session: UserSession
    ip: str | None


def get_current_user(
    request: Request,
    db: DbSession,
    authorization: str | None = Header(default=None),
) -> CurrentUser:
    if not authorization or not authorization.startswith("Bearer "):
        raise Unauthorized("Token Bearer requerido")
    try:
        payload = decode_access_token(authorization.removeprefix("Bearer ").strip())
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
