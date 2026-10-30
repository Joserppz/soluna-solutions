"""Inicio de sesión administrativo con JWT (RF-01)."""

import uuid
from dataclasses import dataclass
from datetime import UTC, datetime, timedelta

from sqlalchemy.orm import Session

from app.core.config import settings
from app.core.errors import Locked, Unauthorized
from app.core.security import create_access_token, hash_password, verify_password
from app.modules.audit import service as audit_service
from app.modules.auth import repository as session_repository
from app.modules.auth.models import UserSession
from app.modules.users import repository as user_repository
from app.modules.users.models import User

INVALID_CREDENTIALS = "Correo o contraseña incorrectos, o usuario inactivo."
ACCOUNT_LOCKED = (
    "Cuenta bloqueada temporalmente por {minutes} minutos tras 5 intentos fallidos (RNF-02)."
)
MAX_FAILED_ATTEMPTS = 5
LOCK_MINUTES = 15
# Hash de referencia para gastar el mismo tiempo cuando el correo no existe y no
# revelar qué cuentas están registradas.
_DUMMY_HASH = hash_password("aspar-usuario-inexistente")


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
    now = datetime.now(UTC)

    if user is not None and user.locked_until is not None and user.locked_until > now:
        minutes = max(1, int((user.locked_until - now).total_seconds() // 60) + 1)
        audit_service.record(
            db,
            actor=email,
            actor_role="Sistema",
            category="AUTENTICACION",
            severity="WARNING",
            action="Intento de acceso a cuenta bloqueada",
            detail=f"La cuenta {email} sigue bloqueada por intentos fallidos",
            ip_address=ip,
        )
        raise Locked(ACCOUNT_LOCKED.format(minutes=minutes), persist=True)

    password_ok = verify_password(password, user.password_hash if user else _DUMMY_HASH)
    if user is None or not user.active or not password_ok:
        _register_failed_attempt(db, user, email, ip, now)
        # persist=True: el contador de intentos y la bitácora se guardan aunque falle el login
        raise Unauthorized(INVALID_CREDENTIALS, persist=True)

    now = datetime.now(UTC)
    session = session_repository.add(
        db,
        UserSession(
            id=str(uuid.uuid4()),
            user_id=user.id,
            expires_at=now + timedelta(seconds=settings.session_max_age_seconds),
            last_activity_at=now,
            ip_address=ip,
            user_agent=(user_agent or "")[:300] or None,
        ),
    )
    user.last_login_at = now
    user.failed_login_attempts = 0
    user.locked_until = None
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
    return LoginResult(
        access_token=issue_token(user, session),
        expires_in=settings.session_max_age_seconds,
        idle_timeout=settings.session_idle_limit_seconds,
        user=user,
    )


def _register_failed_attempt(
    db: Session, user: User | None, email: str, ip: str | None, now: datetime
) -> None:
    severity = "WARNING"
    detail = f"Credenciales inválidas o cuenta inactiva para {email}"
    if user is not None and user.active:
        user.failed_login_attempts += 1
        if user.failed_login_attempts >= MAX_FAILED_ATTEMPTS:
            user.locked_until = now + timedelta(minutes=LOCK_MINUTES)
            user.failed_login_attempts = 0
            severity = "CRITICAL"
            detail = (
                f"Cuenta {email} bloqueada {LOCK_MINUTES} min tras {MAX_FAILED_ATTEMPTS} intentos"
            )
    audit_service.record(
        db,
        actor=email,
        actor_role="Sistema",
        category="AUTENTICACION",
        severity=severity,
        action="Intento fallido de inicio de sesión",
        detail=detail,
        ip_address=ip,
    )


@dataclass
class RefreshResult:
    access_token: str
    expires_in: int


def refresh(db: Session, user: User, session: UserSession, ip: str | None) -> RefreshResult:
    now = datetime.now(UTC)
    session.expires_at = now + timedelta(seconds=settings.session_max_age_seconds)
    session.refreshed_at = now
    session.refresh_count += 1
    audit_service.record(
        db,
        actor=user.email,
        actor_role=user.role,
        category="AUTENTICACION",
        severity="INFO",
        action="Renovación de token JWT",
        detail=f"Se renovó el token de sesión activa para {user.email}",
        ip_address=ip,
    )
    return RefreshResult(
        access_token=issue_token(user, session), expires_in=settings.session_max_age_seconds
    )


def logout(db: Session, user: User, session: UserSession, ip: str | None) -> None:
    session.revoked_at = datetime.now(UTC)
    audit_service.record(
        db,
        actor=user.email,
        actor_role=user.role,
        category="AUTENTICACION",
        severity="INFO",
        action="Cierre de sesión",
        detail=f"Sesión finalizada correctamente por {user.email}",
        ip_address=ip,
    )
