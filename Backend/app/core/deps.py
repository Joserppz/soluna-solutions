"""Dependencias de FastAPI: usuario autenticado a partir del token Bearer."""

from dataclasses import dataclass
from datetime import UTC, datetime

import jwt
from fastapi import Depends, Header, HTTPException, Request, status
from sqlalchemy.orm import Session

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

    user = user_repository.get_by_id(db, session.user_id)
    if user is None or not user.active:
        raise HTTPException(status.HTTP_401_UNAUTHORIZED, SESSION_INVALID)
    return CurrentUser(user=user, session=session, ip=client_ip(request))
