"""Administración de usuarios y roles del personal de ASPAR (RF-11)."""

import re
import secrets
import uuid
from datetime import UTC, datetime, timedelta

from sqlalchemy.orm import Session

from app.core.config import settings
from app.core.errors import Conflict, NotFound, ValidationError
from app.core.pagination import PageParams, PageResult
from app.core.security import hash_password
from app.modules.audit import service as audit_service
from app.modules.auth import repository as session_repository
from app.modules.auth.dependencies import CurrentUser
from app.modules.auth.schemas import EMAIL_PATTERN
from app.modules.users import repository as user_repository
from app.modules.users.models import ADMIN, ROLE_KEYS, Role, User
from app.modules.users.schemas import UserApprove, UserCreate, UserUpdate

NOT_FOUND = "Usuario no encontrado."


def validate_password(password: str) -> None:
    if len(password) < 8:
        raise ValidationError("La contraseña debe tener al menos 8 caracteres.")
    if len(password.encode()) > 72:
        raise ValidationError("La contraseña no puede superar 72 bytes.")
    if not re.search(r"[A-Za-z]", password) or not re.search(r"\d", password):
        raise ValidationError("La contraseña debe combinar letras y números.")


# Palabras para contraseñas temporales legibles (formato Palabra-4Digitos-Palabra).
# 122 x 122 x 10.000 combinaciones (~27 bits): suficiente para una contraseña
# que vence en TEMP_PASSWORD_HOURS, se cambia al ingresar y tiene bloqueo por intentos.
TEMP_PASSWORD_WORDS = (
    "Achachi",
    "Aguila",
    "Alba",
    "Alpaca",
    "Amaru",
    "Andes",
    "Arce",
    "Arena",
    "Aroma",
    "Arroyo",
    "Aurora",
    "Avena",
    "Ayni",
    "Bahia",
    "Brisa",
    "Cacao",
    "Calma",
    "Camino",
    "Canela",
    "Cantuta",
    "Cedro",
    "Ceibo",
    "Celeste",
    "Cielo",
    "Cima",
    "Coca",
    "Colibri",
    "Condor",
    "Coral",
    "Cosecha",
    "Cristal",
    "Cumbre",
    "Delta",
    "Diana",
    "Dorado",
    "Duna",
    "Eco",
    "Encino",
    "Estrella",
    "Fuente",
    "Gacela",
    "Girasol",
    "Granito",
    "Guinda",
    "Halcon",
    "Helecho",
    "Hoja",
    "Huerto",
    "Illampu",
    "Illimani",
    "Inti",
    "Isla",
    "Jade",
    "Jaguar",
    "Jardin",
    "Jazmin",
    "Kantuta",
    "Killa",
    "Lago",
    "Laguna",
    "Lapacho",
    "Laurel",
    "Lirio",
    "Llama",
    "Llovizna",
    "Luna",
    "Madero",
    "Maiz",
    "Mango",
    "Manzana",
    "Mar",
    "Menta",
    "Mirlo",
    "Molle",
    "Monte",
    "Musgo",
    "Nevado",
    "Niebla",
    "Nogal",
    "Nube",
    "Olivo",
    "Ombu",
    "Ondina",
    "Orquidea",
    "Pacha",
    "Palma",
    "Paloma",
    "Pampa",
    "Pino",
    "Plata",
    "Pradera",
    "Puma",
    "Quinua",
    "Rayo",
    "Retama",
    "Rio",
    "Roble",
    "Rocio",
    "Rosal",
    "Sabana",
    "Salvia",
    "Sauce",
    "Selva",
    "Sendero",
    "Sol",
    "Suri",
    "Tajibo",
    "Tarija",
    "Tierra",
    "Titicaca",
    "Topacio",
    "Trigo",
    "Tulipan",
    "Tunari",
    "Urpi",
    "Valle",
    "Vicuna",
    "Viento",
    "Yareta",
    "Yungas",
    "Zafiro",
    "Zorzal",
)


def temporary_password() -> str:
    """Contraseña temporal legible, distinta cada vez (por ejemplo Ceibo-4821-Sol)."""
    first, last = secrets.choice(TEMP_PASSWORD_WORDS), secrets.choice(TEMP_PASSWORD_WORDS)
    return f"{first}-{secrets.randbelow(10000):04d}-{last}"


def _set_temporary_password(user: User) -> str:
    """Asigna una contraseña temporal que vence y que la persona debe cambiar al ingresar."""
    password = temporary_password()
    now = datetime.now(UTC)
    user.password_hash = hash_password(password)
    user.must_change_password = True
    user.temp_password_expires_at = now + timedelta(hours=settings.temp_password_hours)
    user.password_changed_at = now
    user.failed_login_attempts = 0
    user.locked_until = None
    return password


def _validate_name(name: str) -> None:
    if len(name.strip()) < 3:
        raise ValidationError("El nombre del usuario debe tener al menos 3 caracteres.")


def _role(db: Session, key: str) -> Role:
    role = user_repository.get_role_by_key(db, key)
    if role is None:
        raise ValidationError("Rol inválido. Usa: " + ", ".join(ROLE_KEYS) + ".")
    return role


def _audit(db: Session, current: CurrentUser, severity: str, action: str, detail: str) -> None:
    audit_service.audit(
        db, current, category="USUARIOS_ROLES", severity=severity, action=action, detail=detail
    )


def list_users(
    db: Session,
    search: str | None = None,
    page: PageParams | None = None,
    role: str | None = None,
) -> PageResult:
    return user_repository.list_users(db, search, page, role)


def get_user(db: Session, user_id: uuid.UUID) -> User:
    user = user_repository.get_by_id(db, user_id)
    if user is None:
        raise NotFound(NOT_FOUND)
    return user


def create_user(db: Session, data: UserCreate, current: CurrentUser) -> tuple[User, str]:
    """Invitación: Administración crea la cuenta y entrega en persona la contraseña temporal."""
    email = data.email.strip().lower()
    _validate_name(data.name)
    role = _role(db, data.role)
    if not EMAIL_PATTERN.match(email):
        raise ValidationError("Ingresa un correo electrónico institucional válido.")
    if user_repository.get_by_email(db, email) is not None:
        raise Conflict("Ya existe un usuario con ese correo.")

    user = User(
        name=data.name.strip(),
        email=email,
        role=role,
        department=data.department.strip() or "General",
        # Administración crea la cuenta y conoce a la persona: el correo se da por válido
        email_verified=True,
        active=True,
    )
    generated = _set_temporary_password(user)
    user_repository.add(db, user)
    _audit(
        db,
        current,
        "WARNING",
        "Creación de usuario",
        f"Creó {user.email} con rol {user.role_name} ({user.department})",
    )
    return user, generated


def update_user(db: Session, user_id: uuid.UUID, data: UserUpdate, current: CurrentUser) -> User:
    user = get_user(db, user_id)
    changes = data.model_dump(exclude_unset=True, exclude_none=True)
    new_role = _role(db, changes.pop("role")) if "role" in changes else user.role
    new_active = changes.get("active", user.active)
    _validate_name(changes.get("name", user.name))

    removes_admin = (
        user.role_key == ADMIN
        and user.active
        and ((new_role.key if new_role else None) != ADMIN or not new_active)
    )
    if removes_admin and user.id == current.user.id:
        raise Conflict(
            "No puedes quitarte el rol de Administración ni desactivar tu propia cuenta."
        )
    if removes_admin and user_repository.count_active_admins(db) <= 1:
        raise Conflict("Debe quedar al menos una persona con rol de Administración activa.")

    access_reduced = new_role is not user.role or (user.active and not new_active)
    user.role = new_role
    for field, value in changes.items():
        setattr(user, field, value.strip() if isinstance(value, str) else value)
    if access_reduced:
        # Los tokens emitidos con el rol anterior dejan de servir de inmediato
        session_repository.revoke_all_for_user(db, user.id)

    _audit(
        db,
        current,
        "CRITICAL" if not user.active else "WARNING",
        "Actualización de usuario y rol",
        f"Usuario {user.email}: rol={user.role_name}, activo={user.active}, "
        f"departamento={user.department}",
    )
    db.flush()
    db.refresh(user)
    return user


def approve_user(db: Session, user_id: uuid.UUID, data: UserApprove, current: CurrentUser) -> User:
    """Aprueba una cuenta «Pendiente de aprobación» (registro abierto o Google) con un rol."""
    user = get_user(db, user_id)
    if user.role is not None:
        raise Conflict("La cuenta ya tiene un rol. Para cambiarlo, edita a la persona.")
    if not user.active:
        raise Conflict("La cuenta está desactivada. Reactívala antes de aprobarla.")
    if not user.email_verified:
        raise Conflict("La persona todavía no confirmó su correo: no se puede aprobar aún.")
    user.role = _role(db, data.role)
    if data.department is not None and data.department.strip():
        user.department = data.department.strip()
    _audit(
        db,
        current,
        "WARNING",
        "Aprobación de cuenta",
        f"Aprobó la cuenta {user.email} con rol {user.role_name} ({user.department})",
    )
    db.flush()
    db.refresh(user)
    return user


def reset_password(db: Session, user_id: uuid.UUID, current: CurrentUser) -> str:
    user = get_user(db, user_id)
    generated = _set_temporary_password(user)
    session_repository.revoke_all_for_user(db, user.id)
    _audit(
        db,
        current,
        "WARNING",
        "Restablecimiento de contraseña",
        f"Restableció la contraseña de {user.email} y cerró sus sesiones activas",
    )
    return generated
