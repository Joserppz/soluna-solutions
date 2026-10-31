"""Datos de demostración para desarrollo y pruebas. Bloqueado en producción (ENV=prod).

Crea una cuenta por rol, una cuenta pendiente de aprobación y algunos afiliados de
ejemplo. Es idempotente: si las cuentas de demostración ya existen, no hace nada.

Uso (desde la carpeta Backend; con Docker: docker compose exec api python -m scripts.seed_demo):
    python -m scripts.seed_demo

Las contraseñas de abajo son públicas: nunca uses este script en la base de producción.
"""

import sys
from datetime import date, time, timedelta

from sqlalchemy.orm import Session

from app.core import clock
from app.core.config import settings
from app.core.database import SessionLocal
from app.core.security import hash_password
from app.models import Patient, PatientContact, PatientEvaluation, Schedule, User
from app.modules.users import repository as user_repository
from app.modules.users.models import (
    ADMIN,
    COORDINATION,
    PROFESSIONAL,
    RECEPTION,
    VOLUNTEER,
)

# rol -> (nombre, correo, contraseña). None = cuenta pendiente de aprobación
DEMO_USERS: dict[str | None, tuple[str, str, str]] = {
    ADMIN: ("Lucía Choque (demo)", "admin@aspar.org", "Admin2026!"),
    COORDINATION: ("René Vargas (demo)", "coordinacion@aspar.org", "Coord2026!"),
    PROFESSIONAL: ("Lic. Ana Flores (demo)", "profesional@aspar.org", "Profesional2026!"),
    RECEPTION: ("Patricia Mendoza (demo)", "recepcion@aspar.org", "Recep2026!"),
    VOLUNTEER: ("Daniel Quispe (demo)", "voluntario@aspar.org", "Voluntario2026!"),
    None: ("Gabriela Rocha (demo)", "pendiente@aspar.org", "Pendiente2026!"),
}

# CI de los afiliados de demostración (las pruebas los buscan por CI)
CI_WITH_CONSENT = "1234567"
CI_WITHOUT_CONSENT = "7654321"
CI_REVOKED = "4455310"


class SeedBlockedError(RuntimeError):
    pass


def _patients() -> list[Patient]:
    return [
        Patient(
            name="Elena Rojas",
            ci=CI_WITH_CONSENT,
            birth_date=date(1956, 4, 12),
            phone="70000001",
            address="Av. Arce 2140, Sopocachi",
            zone="Sopocachi",
            consent=True,
            consent_date=date(2026, 8, 15),
            image_consent=True,
            access_status="Activo",
            diagnosis="Enfermedad de Parkinson idiopática",
            stage="Estadio II (Bilateral sin alteración del equilibrio)",
            neurologist_certificate=True,
            symptom_notes="Temblor en reposo en el brazo derecho y bradicinesia leve.",
            medications="Levodopa/Carbidopa 250/25 mg cada 8 horas",
            contacts=[
                PatientContact(
                    name="Carlos Rojas", relation="Hijo", phone="71522334", is_primary=True
                )
            ],
        ),
        Patient(
            name="Miguel Fernández",
            ci=CI_WITHOUT_CONSENT,
            phone="70000002",
            address="Calle 15 de Calacoto 450",
            zone="Calacoto",
            consent=False,
            access_status="Pendiente",
            diagnosis="Parkinsonismo en evaluación",
            stage="Estadio I (Leve unilateral)",
            contacts=[
                PatientContact(
                    name="Lucía Fernández", relation="Esposa", phone="70688912", is_primary=True
                )
            ],
        ),
        Patient(
            name="Gloria Condori",
            ci=CI_REVOKED,
            phone="70000003",
            zone="Villa Fátima",
            consent=True,
            consent_date=date(2026, 2, 3),
            access_status="Revocado",
            diagnosis="Enfermedad de Parkinson",
            stage="Estadio III (Moderado con inestabilidad postural)",
            contacts=[
                PatientContact(
                    name="Raúl Condori", relation="Hijo", phone="76543210", is_primary=True
                )
            ],
        ),
    ]


def seed(db: Session) -> list[str]:
    """Inserta los datos de demostración; devuelve lo que creó."""
    if settings.is_prod:
        raise SeedBlockedError("seed_demo está bloqueado en producción (ENV=prod).")
    if user_repository.get_by_email(db, DEMO_USERS[ADMIN][1]) is not None:
        return []

    created = []
    for role_key, (name, email, password) in DEMO_USERS.items():
        db.add(
            User(
                name=name,
                email=email,
                password_hash=hash_password(password),
                role=user_repository.get_role_by_key(db, role_key) if role_key else None,
                email_verified=True,
                active=True,
                failed_login_attempts=0,
            )
        )
        created.append(f"{email} / {password} ({role_key or 'pendiente de aprobación'})")
    patients = _patients()
    for patient in patients:
        db.add(patient)
        created.append(f"Afiliado {patient.name} (CI {patient.ci}, {patient.access_status})")
    db.flush()
    professional = user_repository.get_by_email(db, DEMO_USERS[PROFESSIONAL][1])
    for evaluation in _evaluations(patients[0], professional):
        db.add(evaluation)
    created.append(f"3 evaluaciones de seguimiento de {patients[0].name}")
    schedules = _schedules(professional)
    db.add_all(schedules)
    created.append(f"{len(schedules)} actividades en la agenda (sábados alrededor de hoy)")
    db.flush()
    return created


def _schedules(professional: User) -> list[Schedule]:
    """Agenda de ejemplo como la del diseño: el sábado pasado y los próximos cinco."""
    today = clock.today()
    last_saturday = today - timedelta(days=(today.weekday() - 5) % 7)

    def saturday(weeks: int) -> date:
        return last_saturday + timedelta(weeks=weeks)

    common = {"start_time": time(10), "location": "Sede ASPAR"}
    return [
        Schedule(
            title="Movimiento en compañía",
            category="fisioterapia",
            date=saturday(0),
            end_time=time(11, 30),
            professional_id=professional.id,
            professional_name=professional.name,
            description="Una sesión de movimiento suave y un momento para conversar.",
            spots=30,
            status="publicada",
            **common,
        ),
        Schedule(
            title="Movimiento en compañía",
            category="fisioterapia",
            date=saturday(1),
            end_time=time(11, 30),
            professional_id=professional.id,
            professional_name=professional.name,
            description="Cada persona a su ritmo, con su familiar o cuidador.",
            spots=30,
            status="publicada",
            **common,
        ),
        Schedule(
            title="Arteterapia: crear juntos",
            category="arteterapia",
            date=saturday(2),
            end_time=time(12),
            professional_name="Lic. Carmen Ríos",
            description="Pintura y collage para expresarnos sin palabras.",
            spots=20,
            status="publicada",
            start_time=time(10),
            location="Sala de talleres",
        ),
        Schedule(
            title="Teatro y expresión",
            category="teatro",
            date=saturday(3),
            end_time=time(11, 30),
            status="cancelada",
            cancellation_note="Se reprogramará en diciembre",
            **common,
        ),
        Schedule(
            title="Encuentro de familias",
            category="familias",
            date=saturday(4),
            end_time=time(12),
            professional_name="Coordinación",
            description="Conversaciones para compartir dudas, experiencias y formas de cuidar.",
            spots=25,
            status="publicada",
            **common,
        ),
        Schedule(
            title="Preparación de diciembre",
            category="comunitario",
            date=saturday(5),
            end_time=time(11, 30),
            status="borrador",
            **common,
        ),
    ]


def _evaluations(patient: Patient, professional: User) -> list[PatientEvaluation]:
    today = clock.today()
    notes = {
        "fisica": "Mejor equilibrio al levantarse de la silla; mantener ejercicios de marcha.",
        "fonoaudiologica": "Voz con buen volumen en el grupo; practicar lectura en voz alta.",
        "psicologica": "Ánimo estable; participa más desde que viene con su hijo.",
    }
    return [
        PatientEvaluation(
            patient_id=patient.id,
            area=area,
            evaluated_on=today - timedelta(days=14 + 30 * index),
            professional_id=professional.id,
            professional_name=professional.name,
            notes=text,
            created_by=professional.id,
        )
        for index, (area, text) in enumerate(notes.items())
    ]


def main() -> int:
    db = SessionLocal()
    try:
        created = seed(db)
        db.commit()
    except SeedBlockedError as exc:
        print(f"ERROR: {exc}", file=sys.stderr)
        return 1
    finally:
        db.close()
    if not created:
        print("Los datos de demostración ya estaban cargados.")
    else:
        print("Datos de demostración creados:")
        for line in created:
            print(f"  - {line}")
    return 0


if __name__ == "__main__":
    sys.exit(main())
