"""Inicio de sesión administrativo con JWT (RF-01)."""

import uuid
from dataclasses import dataclass
from datetime import UTC, datetime, timedelta

from fastapi import HTTPException, status
from sqlalchemy.orm import Session

from app.core.config import SESSION_IDLE_LIMIT_SECONDS, SESSION_MAX_AGE_SECONDS
from app.core.security import create_access_token, verify_password
from app.models import User, UserSession
from app.repositories import session_repository, user_repository
from app.services import audit_service

INVALID_CREDENTIALS = "Correo o contraseña incorrectos, o usuario inactivo."


@dataclass
class LoginResult:
    access_token: str
    expires_in: int
    idle_timeout: int
    user: User


def issue_token(user: User, session: UserSession) -> str:
    return create_access_token(
        user_id=user.id, session_id=session.id, email=user.email, name=user.name, role=user.role
    )


def login(
    db: Session, email: str, password: str, ip: str | None, user_agent: str | None
) -> LoginResult:
    email = email.strip().lower()
    user = user_repository.get_by_email(db, email)

    if user is None or not user.active or not verify_password(password, user.password_hash):
        audit_service.record(
            db,
            actor=email,
            actor_role="Sistema",
            category="AUTENTICACION",
            severity="WARNING",
            action="Intento fallido de inicio de sesión",
            detail=f"Credenciales inválidas o cuenta inactiva para {email}",
            ip_address=ip,
        )
        db.commit()
        raise HTTPException(status.HTTP_401_UNAUTHORIZED, INVALID_CREDENTIALS)

    now = datetime.now(UTC)
    session = session_repository.add(
        db,
        UserSession(
            id=str(uuid.uuid4()),
            user_id=user.id,
            expires_at=now + timedelta(seconds=SESSION_MAX_AGE_SECONDS),
            last_activity_at=now,
            ip_address=ip,
            user_agent=(user_agent or "")[:300] or None,
        ),
    )
    user.last_login_at = now
    audit_service.record(
        db,
        actor=user.email,
        actor_role=user.role,
        category="AUTENTICACION",
        severity="INFO",
        action="Inicio de sesión administrativo",
        detail=f"Autenticación JWT exitosa para {user.email} ({user.role})",
        ip_address=ip,
    )
    db.commit()
    return LoginResult(
        access_token=issue_token(user, session),
        expires_in=SESSION_MAX_AGE_SECONDS,
        idle_timeout=SESSION_IDLE_LIMIT_SECONDS,
        user=user,
    )
