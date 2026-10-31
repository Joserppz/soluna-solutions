"""Dependencias de FastAPI: usuario autenticado a partir de la cookie de sesión."""

import uuid
from dataclasses import dataclass
from datetime import UTC, datetime, timedelta

import jwt
from fastapi import Depends, Request
from sqlalchemy import select
from sqlalchemy.orm import Session

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
from app.modules.users.models import Permission, User

SESSION_INVALID = "Sesión inválida o expirada. Inicia sesión nuevamente."
SESSION_IDLE_EXPIRED = "La sesión expiró por inactividad (15 minutos). Inicia sesión nuevamente."
CSRF_INVALID = "Falta el token de seguridad de la sesión (X-CSRF-Token). Recarga la página."
MUST_CHANGE_PASSWORD = "Cambia tu contraseña temporal antes de continuar."  # noqa: S105
# La actividad se guarda como mucho una vez por minuto: evita escribir en cada petición
ACTIVITY_WRITE_INTERVAL = timedelta(seconds=60)


@dataclass
class CurrentUser:
    user: User
    session: UserSession
    ip: str | None
    # Permisos del rol, leídos de la base una vez por petición
    permissions: frozenset[str]

    def can(self, permission: str) -> bool:
        return permission in self.permissions


def load_permissions(db: Session, user: User) -> frozenset[str]:
    """Permisos efectivos: el rol del sistema (admin) siempre tiene todos."""
    if user.role is None:
        return frozenset()
    if user.role.is_system:
        return frozenset(db.scalars(select(Permission.key)))
    return frozenset(permission.key for permission in user.role.permissions)


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
    return CurrentUser(
        user=user,
        session=session,
        ip=client_ip(request),
        permissions=load_permissions(db, user),
    )


def require_permission(*permissions: str, any_of: bool = False):
    """Permite el acceso solo si el rol tiene TODOS los permisos indicados (tabla role_permissions).

    Con ``any_of=True`` basta con uno de ellos (por ejemplo, la agenda la ve quien gestiona
    actividades o quien toma asistencia).

    Los rechazos quedan en la bitácora. Una cuenta sin rol o con contraseña temporal
    pendiente de cambio no pasa ninguna verificación.
    """

    def checker(
        request: Request,
        db: DbSession,
        current: CurrentUser = Depends(get_current_user),
    ) -> CurrentUser:
        if current.user.must_change_password:
            raise Forbidden(MUST_CHANGE_PASSWORD)
        missing = [permission for permission in permissions if not current.can(permission)]
        if any_of and len(missing) < len(permissions):
            missing = []
        if missing:
            audit_service.record_grouped(
                db,
                group_key=f"acceso_bloqueado:{current.user.id}:{request.method}:{request.url.path}",
                window=timedelta(minutes=15),
                actor=current.user.email,
                actor_role=current.user.role_name,
                category="SISTEMA",
                severity="WARNING",
                action="Intento de acceso restringido bloqueado",
                detail=(
                    f"El rol {current.user.role_name} intentó {request.method} "
                    f"{request.url.path} sin el permiso "
                    f"{(' ni ' if any_of else ', ').join(missing)}"
                ),
                ip_address=current.ip,
            )
            raise Forbidden(
                f"Tu rol ({current.user.role_name}) no tiene permiso para esta operación.",
                persist=True,
            )
        return current

    return checker
