"""Administración de usuarios y roles del personal de ASPAR (RF-11)."""

import re
import secrets
import uuid
from datetime import UTC, datetime

from fastapi import HTTPException, status
from sqlalchemy.orm import Session

from app.core.constants import ROLES
from app.core.deps import CurrentUser
from app.core.security import hash_password
from app.models import User
from app.repositories import session_repository, user_repository
from app.schemas.auth import EMAIL_PATTERN
from app.schemas.user import UserCreate, UserUpdate
from app.services import audit_service

NOT_FOUND = "Usuario no encontrado."


def _unprocessable(message: str) -> HTTPException:
    return HTTPException(status.HTTP_422_UNPROCESSABLE_CONTENT, message)


def validate_password(password: str) -> None:
    if len(password) < 8:
        raise _unprocessable("La contraseña debe tener al menos 8 caracteres.")
    if len(password.encode()) > 72:
        raise _unprocessable("La contraseña no puede superar 72 bytes.")
    if not re.search(r"[A-Za-z]", password) or not re.search(r"\d", password):
        raise _unprocessable("La contraseña debe combinar letras y números.")


def temporary_password() -> str:
    return f"Aspar-{secrets.token_urlsafe(9)}7"


def _validate_profile(name: str, role: str) -> None:
    if len(name.strip()) < 3:
        raise _unprocessable("El nombre del usuario debe tener al menos 3 caracteres.")
    if role not in ROLES:
        raise _unprocessable("Rol inválido. Usa: " + ", ".join(ROLES) + ".")


def _audit(db: Session, current: CurrentUser, severity: str, action: str, detail: str) -> None:
    audit_service.record(
        db,
        actor=current.user.email,
        actor_role=current.user.role,
        category="USUARIOS_ROLES",
        severity=severity,
        action=action,
        detail=detail,
        ip_address=current.ip,
    )


def list_users(db: Session) -> list[User]:
    return user_repository.list_users(db)


def get_user(db: Session, user_id: str) -> User:
    user = user_repository.get_by_id(db, user_id)
    if user is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, NOT_FOUND)
    return user


def create_user(db: Session, data: UserCreate, current: CurrentUser) -> tuple[User, str | None]:
    email = data.email.strip().lower()
    _validate_profile(data.name, data.role)
    if not EMAIL_PATTERN.match(email):
        raise _unprocessable("Ingresa un correo electrónico institucional válido.")
    if user_repository.get_by_email(db, email) is not None:
        raise HTTPException(status.HTTP_409_CONFLICT, "Ya existe un usuario con ese correo.")

    generated = None if data.password else temporary_password()
    password = data.password or generated
    validate_password(password)

    now = datetime.now(UTC)
    user = user_repository.add(
        db,
        User(
            id=f"u-{uuid.uuid4().hex[:8]}",
            name=data.name.strip(),
            email=email,
            password_hash=hash_password(password),
            role=data.role,
            department=data.department.strip() or "General",
            active=True,
            failed_login_attempts=0,
            created_at=now,
            updated_at=now,
        ),
    )
    _audit(
        db,
        current,
        "WARNING",
        "Creación de usuario",
        f"Creó {user.email} con rol {user.role} ({user.department})",
    )
    db.commit()
    return user, generated


def update_user(db: Session, user_id: str, data: UserUpdate, current: CurrentUser) -> User:
    user = get_user(db, user_id)
    changes = data.model_dump(exclude_unset=True, exclude_none=True)
    new_role = changes.get("role", user.role)
    new_active = changes.get("active", user.active)
    _validate_profile(changes.get("name", user.name), new_role)

    removes_admin = (
        user.role == "Administrador"
        and user.active
        and (new_role != "Administrador" or not new_active)
    )
    if removes_admin and user.id == current.user.id:
        raise HTTPException(
            status.HTTP_409_CONFLICT,
            "No puedes quitarte el rol de Administrador ni desactivar tu propia cuenta.",
        )
    if removes_admin and user_repository.count_active_admins(db) <= 1:
        raise HTTPException(
            status.HTTP_409_CONFLICT, "Debe quedar al menos un Administrador activo."
        )

    access_reduced = new_role != user.role or (user.active and not new_active)
    for field, value in changes.items():
        setattr(user, field, value.strip() if isinstance(value, str) else value)
    user.updated_at = datetime.now(UTC)
    if access_reduced:
        # Los tokens emitidos con el rol anterior dejan de servir de inmediato
        session_repository.revoke_all_for_user(db, user.id)

    _audit(
        db,
        current,
        "CRITICAL" if not user.active else "WARNING",
        "Actualización de usuario y rol",
        f"Usuario {user.email}: rol={user.role}, activo={user.active}, "
        f"departamento={user.department}",
    )
    db.commit()
    db.refresh(user)
    return user


def reset_password(
    db: Session, user_id: str, password: str | None, current: CurrentUser
) -> str | None:
    user = get_user(db, user_id)
    generated = None if password else temporary_password()
    new_password = password or generated
    validate_password(new_password)

    user.password_hash = hash_password(new_password)
    user.failed_login_attempts = 0
    user.locked_until = None
    user.updated_at = datetime.now(UTC)
    session_repository.revoke_all_for_user(db, user.id)
    _audit(
        db,
        current,
        "WARNING",
        "Restablecimiento de contraseña",
        f"Restableció la contraseña de {user.email} y cerró sus sesiones activas",
    )
    db.commit()
    return generated
