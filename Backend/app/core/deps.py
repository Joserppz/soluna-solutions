"""Dependencias de FastAPI: usuario autenticado a partir del token Bearer."""

from dataclasses import dataclass
from datetime import UTC, datetime, timedelta

import jwt
from fastapi import Depends, Header, HTTPException, Request, status
from sqlalchemy.orm import Session

from app.core.config import SESSION_IDLE_LIMIT_SECONDS
from app.core.database import get_db
from app.core.security import decode_access_token
from app.models import User, UserSession
from app.repositories import session_repository, user_repository

SESSION_INVALID = "Sesión inválida o expirada. Inicia sesión nuevamente."


@dataclass
class CurrentUser:
    user: User
    session: UserSession
    ip: str | None


def client_ip(request: Request) -> str | None:
    return request.client.host if request.client else None


def get_current_user(
    request: Request,
    authorization: str | None = Header(default=None),
    db: Session = Depends(get_db),
) -> CurrentUser:
    if not authorization or not authorization.startswith("Bearer "):
        raise HTTPException(status.HTTP_401_UNAUTHORIZED, "Token Bearer requerido")
    try:
        payload = decode_access_token(authorization.removeprefix("Bearer ").strip())
    except jwt.PyJWTError as exc:
        raise HTTPException(status.HTTP_401_UNAUTHORIZED, SESSION_INVALID) from exc

    session = session_repository.get_by_id(db, payload["sid"])
    now = datetime.now(UTC)
    if (
        session is None
        or session.user_id != payload["sub"]
        or session.revoked_at is not None
        or session.expires_at <= now
    ):
        raise HTTPException(status.HTTP_401_UNAUTHORIZED, SESSION_INVALID)
    if session.last_activity_at + timedelta(seconds=SESSION_IDLE_LIMIT_SECONDS) <= now:
        session.revoked_at = now
        db.commit()
        raise HTTPException(
            status.HTTP_401_UNAUTHORIZED,
            "La sesión expiró por inactividad (15 minutos). Inicia sesión nuevamente.",
        )

    user = user_repository.get_by_id(db, session.user_id)
    if user is None or not user.active:
        raise HTTPException(status.HTTP_401_UNAUTHORIZED, SESSION_INVALID)

    # Cada petición autenticada cuenta como actividad (límite de inactividad RNF-02)
    session.last_activity_at = now
    db.commit()
    return CurrentUser(user=user, session=session, ip=client_ip(request))


def require_roles(*roles: str):
    """Permite el acceso solo a los roles indicados; los rechazos quedan en la bitácora."""

    def checker(
        request: Request,
        current: CurrentUser = Depends(get_current_user),
        db: Session = Depends(get_db),
    ) -> CurrentUser:
        if current.user.role not in roles:
            # Import diferido: audit_service depende de los modelos, no de deps
            from app.services import audit_service

            audit_service.record(
                db,
                actor=current.user.email,
                actor_role=current.user.role,
                category="SISTEMA",
                severity="WARNING",
                action="Intento de acceso restringido bloqueado",
                detail=(
                    f"El rol {current.user.role} intentó {request.method} {request.url.path} "
                    f"(permitido para: {', '.join(roles)})"
                ),
                ip_address=current.ip,
            )
            db.commit()
            raise HTTPException(
                status.HTTP_403_FORBIDDEN,
                f"El rol {current.user.role} no tiene permisos para esta operación.",
            )
        return current

    return checker
