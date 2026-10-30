"""Crea la primera cuenta de Administración (o promueve una existente).

Ningún usuario vive en el código ni en las migraciones: la cuenta oficial de ASPAR se
crea una vez con este script, desde una terminal con acceso a la base.

Uso (desde la carpeta Backend; con Docker: docker compose exec api python -m scripts.create_admin):
    python -m scripts.create_admin                      # pregunta nombre, correo y contraseña
    python -m scripts.create_admin --email x@y.com --name "Nombre"
    python -m scripts.create_admin --email x@y.com --promote   # rol de Administración
                                                               # a una cuenta que ya existe

La contraseña se escribe dos veces y nunca se muestra ni se guarda en texto plano.
"""

import argparse
import getpass
import sys

from sqlalchemy.orm import Session

from app.core.database import SessionLocal
from app.core.errors import DomainError
from app.core.security import hash_password
from app.models import User
from app.modules.audit import service as audit_service
from app.modules.auth.schemas import EMAIL_PATTERN
from app.modules.users import repository as user_repository
from app.modules.users.models import ADMIN
from app.modules.users.service import validate_password


class AdminError(RuntimeError):
    pass


def create_admin(db: Session, *, name: str, email: str, password: str) -> User:
    email = email.strip().lower()
    if not EMAIL_PATTERN.match(email) or len(email) > 150:
        raise AdminError("El correo no es válido.")
    if len(name.strip()) < 3:
        raise AdminError("El nombre debe tener al menos 3 caracteres.")
    if user_repository.get_by_email(db, email) is not None:
        raise AdminError("Ya existe una cuenta con ese correo. Usa --promote para darle el rol.")
    try:
        validate_password(password)
    except DomainError as exc:
        raise AdminError(exc.message) from exc

    user = user_repository.add(
        db,
        User(
            name=name.strip(),
            email=email,
            password_hash=hash_password(password),
            role=user_repository.get_role_by_key(db, ADMIN),
            email_verified=True,
            active=True,
            failed_login_attempts=0,
        ),
    )
    _audit(db, f"Creó la cuenta de Administración {email} desde la consola")
    return user


def promote(db: Session, email: str) -> User:
    user = user_repository.get_by_email(db, email)
    if user is None:
        raise AdminError("No existe una cuenta con ese correo.")
    user.role = user_repository.get_role_by_key(db, ADMIN)
    user.active = True
    _audit(db, f"Asignó el rol de Administración a {user.email} desde la consola")
    return user


def _audit(db: Session, detail: str) -> None:
    audit_service.record(
        db,
        actor="consola",
        actor_role="Sistema",
        category="USUARIOS_ROLES",
        severity="CRITICAL",
        action="Alta de Administración por consola",
        detail=detail,
    )


def _ask_password() -> str:
    password = getpass.getpass("Contraseña (mínimo 8 caracteres, letras y números): ")
    if password != getpass.getpass("Repite la contraseña: "):
        raise AdminError("Las contraseñas no coinciden.")
    return password


def main() -> int:
    parser = argparse.ArgumentParser(description="Crea la cuenta de Administración de ASPAR")
    parser.add_argument("--email")
    parser.add_argument("--name")
    parser.add_argument("--promote", action="store_true", help="dar el rol a una cuenta existente")
    args = parser.parse_args()

    email = args.email or input("Correo de la cuenta: ")
    db = SessionLocal()
    try:
        if args.promote:
            user = promote(db, email)
        else:
            name = args.name or input("Nombre completo: ")
            user = create_admin(db, name=name, email=email, password=_ask_password())
        db.commit()
        # Con la sesión abierta: después de close() la cuenta ya no se puede leer
        print(f"Listo: {user.email} tiene el rol de Administración.")
    except AdminError as exc:
        db.rollback()
        print(f"ERROR: {exc}", file=sys.stderr)
        return 1
    finally:
        db.close()
    return 0


if __name__ == "__main__":
    sys.exit(main())
