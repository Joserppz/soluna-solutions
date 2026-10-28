"""Reemplaza las contraseñas conocidas de las cuentas sembradas por la migración 001.

La migración 001 crea cuentas de demostración y de administración con contraseñas que
están escritas en el repositorio. Antes de usar el sistema con datos reales, cada cuenta
que todavía tenga su contraseña inicial recibe una contraseña aleatoria nueva, se cierran
sus sesiones y queda registrado en la bitácora (SCRUM-64 / SCRUM-104).

Uso (desde la carpeta Backend, con DATABASE_URL apuntando a la base que se protege):

    python -m scripts.rotar_contrasenas_iniciales --dry-run   # solo muestra qué cuentas cambia
    python -m scripts.rotar_contrasenas_iniciales             # cambia y muestra las nuevas UNA vez

Las contraseñas nuevas se muestran una sola vez: entrégalas a cada persona por un canal
privado y pídele que la cambie. Ejecutarlo de nuevo no modifica cuentas ya rotadas.
"""

import argparse
from datetime import UTC, datetime

from sqlalchemy.orm import Session

from app.core.security import hash_password, verify_password
from app.repositories import session_repository, user_repository
from app.services import audit_service
from app.services.user_service import temporary_password

# Contraseñas que la migración 001 deja en el repositorio (no son secretas)
SEED_PASSWORDS = {
    "admin@aspar.org": "Admin2026!",
    "coordinacion@aspar.org": "Coord2026!",
    "demo@aspar.org": "Aspar2026!",
    "recepcion@aspar.org": "Recep2026!",
    "voluntario@aspar.org": "Voluntario2026!",
    "dayana.rojas@ucb.edu.bo": "Admin123",
    "jose.rodriguez.p@ucb.edu.bo": "Admin123",
}


def accounts_with_seed_password(db: Session) -> list[str]:
    """Correos de las cuentas que todavía conservan su contraseña inicial."""
    pending = []
    for email, seed in SEED_PASSWORDS.items():
        user = user_repository.get_by_email(db, email)
        if user is not None and verify_password(seed, user.password_hash):
            pending.append(user.email)
    return pending


def rotate_seed_passwords(db: Session) -> dict[str, str]:
    """Asigna una contraseña aleatoria a cada cuenta pendiente y devuelve correo -> contraseña."""
    rotated: dict[str, str] = {}
    now = datetime.now(UTC)
    for email in accounts_with_seed_password(db):
        user = user_repository.get_by_email(db, email)
        new_password = temporary_password()
        user.password_hash = hash_password(new_password)
        user.failed_login_attempts = 0
        user.locked_until = None
        user.updated_at = now
        session_repository.revoke_all_for_user(db, user.id)
        audit_service.record(
            db,
            actor="scripts.rotar_contrasenas_iniciales",
            actor_role="Sistema",
            category="USUARIOS_ROLES",
            severity="WARNING",
            action="Rotación de contraseña inicial",
            detail=f"Se reemplazó la contraseña sembrada de {user.email} y se cerraron sesiones",
        )
        rotated[user.email] = new_password
    db.commit()
    return rotated


def main() -> None:
    parser = argparse.ArgumentParser(description="Rota las contraseñas sembradas por la 001")
    parser.add_argument("--dry-run", action="store_true", help="solo lista las cuentas")
    args = parser.parse_args()

    from app.core.database import SessionLocal

    with SessionLocal() as db:
        if args.dry_run:
            pending = accounts_with_seed_password(db)
            print(f"Cuentas con contraseña inicial: {len(pending)}")
            for email in pending:
                print(f"  - {email}")
            return
        rotated = rotate_seed_passwords(db)

    if not rotated:
        print("Ninguna cuenta conserva su contraseña inicial. No se cambió nada.")
        return
    print("Contraseñas nuevas (se muestran UNA sola vez; entrégalas por un canal privado):")
    for email, password in rotated.items():
        print(f"  {email:32} {password}")


if __name__ == "__main__":
    main()
