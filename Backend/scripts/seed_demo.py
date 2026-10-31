"""Datos de demostración para desarrollo y pruebas. Bloqueado en producción (ENV=prod).

Crea una cuenta por rol, una cuenta pendiente de aprobación y algunos afiliados de
ejemplo. Es idempotente: si las cuentas de demostración ya existen, no hace nada.

Uso (desde la carpeta Backend; con Docker: docker compose exec api python -m scripts.seed_demo):
    python -m scripts.seed_demo

Las contraseñas de abajo son públicas: nunca uses este script en la base de producción.
"""

import sys
from datetime import date, time, timedelta
from decimal import Decimal

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.core import clock
from app.core.config import settings
from app.core.database import SessionLocal
from app.core.security import hash_password
from app.models import (
    Attendance,
    Donation,
    DonationGoal,
    DonationGoalMilestone,
    InstitutionalSection,
    InventoryItem,
    MediaAlbum,
    MediaAsset,
    MediaPatientTag,
    Patient,
    PatientContact,
    PatientEvaluation,
    Schedule,
    User,
)
from app.modules.institutional.schemas import SECTION_MODELS
from app.modules.inventory.schemas import ItemIn
from app.modules.inventory.service import register_item
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
    # Asistencia del sábado pasado: una vino, otro avisó que no venía, la tercera sin marcar
    last_saturday = schedules[0]
    marked_at = clock.now()
    db.add_all(
        [
            Attendance(
                schedule_id=last_saturday.id,
                patient_id=patients[0].id,
                status="vino",
                note="Viene con su hijo",
                marked_by=professional.id,
                marked_at=marked_at,
            ),
            Attendance(
                schedule_id=last_saturday.id,
                patient_id=patients[1].id,
                status="no_vino",
                note="Avisó que estaba resfriado",
                marked_by=professional.id,
                marked_at=marked_at,
            ),
        ]
    )
    created.append("Asistencia de ejemplo del sábado pasado")
    coordinator = user_repository.get_by_email(db, DEMO_USERS[COORDINATION][1])
    for item in INVENTORY:
        register_item(db, ItemIn(**item), coordinator.id)
    created.append(f"{len(INVENTORY)} materiales en el inventario (uno dañado)")
    created.append(_donations(db, coordinator))
    created.append(_gallery(db, coordinator, patients))
    created.append(_content(db, coordinator))
    db.flush()
    return created


# Imágenes de muestra públicas de Cloudinary (cuenta «demo»)
DEMO_IMAGE = "https://res.cloudinary.com/demo/image/upload/{}"


def _gallery(db: Session, coordinator: User, patients: list[Patient]) -> str:
    """Un álbum publicado y otro en revisión con una persona sin permiso de imagen."""
    published = MediaAlbum(
        title="Encontrarnos en movimiento",
        description="Fisioterapia en grupo, cada sábado.",
        visibility="publico",
        permissions_reviewed=True,
        reviewed_by=coordinator.id,
        reviewed_at=clock.now(),
        created_by=coordinator.id,
    )
    review = MediaAlbum(
        title="Crear con las manos",
        description="Una mañana de pinceles y acuarelas en el taller de arteterapia.",
        created_by=coordinator.id,
    )
    db.add_all([published, review])
    db.flush()
    for album, names in ((published, ("sample.jpg", "couple.jpg")), (review, ("dog.jpg",))):
        for name in names:
            album.assets.append(
                MediaAsset(
                    kind="imagen",
                    public_id=f"aspar/albums/{album.id}/{name.split('.')[0]}",
                    url=DEMO_IMAGE.format(name),
                    thumbnail_url=DEMO_IMAGE.format(f"w_400/{name}"),
                    width=1200,
                    height=800,
                    size_bytes=250_000,
                    uploaded_by=coordinator.id,
                )
            )
    db.flush()
    # Elena autorizó el uso de su imagen; Miguel no (la foto queda con advertencia)
    review.assets[0].tags = [
        MediaPatientTag(patient_id=patients[0].id, tagged_by=coordinator.id),
        MediaPatientTag(patient_id=patients[1].id, tagged_by=coordinator.id),
    ]
    return "2 álbumes de galería (uno publicado y otro en revisión con una advertencia)"


def _content(db: Session, coordinator: User) -> str:
    texts = {
        "presentacion": {
            "titulo": "La vida se vive mejor en comunidad.",
            "subtitulo": "Un espacio de encuentro para personas con Parkinson y trastornos "
            "del movimiento, sus familias y quienes las cuidan.",
            "texto": "",
        },
        "mision_vision": {
            "titulo": "Acompañar también es hacer lugar.",
            "mision": "Acompañar a personas con Parkinson y trastornos del movimiento, "
            "fortaleciendo su bienestar y sus vínculos a través de actividades comunitarias.",
            "vision": "Una comunidad donde vivir con una condición de movimiento no signifique "
            "vivir sin apoyo.",
        },
    }
    for key, content in texts.items():
        section = db.scalar(select(InstitutionalSection).where(InstitutionalSection.key == key))
        section.draft_content = (
            SECTION_MODELS[key].model_validate(content).model_dump(by_alias=True)
        )
        section.published_content = dict(section.draft_content)
        section.published_by = section.draft_updated_by = coordinator.id
        section.published_at = section.draft_updated_at = clock.now()
    return "Contenido publicado: Presentación y Misión y visión"


def _donations(db: Session, coordinator: User) -> str:
    """Meta visible con hitos y aportes en cada estado (diseño págs. 4 y 15)."""
    goal = DonationGoal(
        title="Espacio propio y equipos de fisioterapia",
        description="Soñamos con un espacio propio y con equipos para los sábados.",
        target_bs=Decimal(60000),
        manual_adjustment_bs=Decimal(18000),
        visible=True,
        starts_on=clock.today() - timedelta(days=200),
        milestones=[
            DonationGoalMilestone(label="Colchonetas y bandas", status="cubierto", position=0),
            DonationGoalMilestone(label="Barras paralelas", status="en_camino", position=1),
            DonationGoalMilestone(label="Espacio propio", status="pendiente", position=2),
        ],
    )
    db.add(goal)
    db.flush()
    today = clock.today()
    reviewed = {"reviewed_by": coordinator.id, "reviewed_at": clock.now()}
    pelotas = db.scalar(select(InventoryItem).where(InventoryItem.name.like("Pelotas%")))
    db.add_all(
        [
            Donation(
                donor_name="Marcela Quispe",
                channel="qr_bancario",
                amount_bs=Decimal(100),
                declared_reference="48213907",
                status="pendiente",
                goal_id=goal.id,
                date=today,
            ),
            Donation(
                channel="qr_bancario",
                amount_bs=Decimal(50),
                status="pendiente",
                goal_id=goal.id,
                date=today,
            ),
            Donation(
                donor_name="Jorge Arce Vargas",
                channel="qr_bancario",
                amount_bs=Decimal(200),
                status="confirmado",
                bank_reference="EXT-20261027-0193",
                credited_on=today - timedelta(days=1),
                goal_id=goal.id,
                date=today - timedelta(days=1),
                **reviewed,
            ),
            Donation(
                donor_name="Familia Rojas Mendoza",
                channel="efectivo",
                source="sede",
                amount_bs=Decimal(300),
                declared_reference="Recibo 0127",
                status="confirmado",
                goal_id=goal.id,
                date=today - timedelta(days=2),
                registered_by=coordinator.id,
                **reviewed,
            ),
            Donation(
                donor_name="Grupo de exalumnos",
                channel="especie",
                source="sede",
                in_kind_description="6 pelotas de terapia de 65 cm",
                status="recibido",
                inventory_item_id=pelotas.id if pelotas else None,
                date=today - timedelta(days=3),
                registered_by=coordinator.id,
                **reviewed,
            ),
            Donation(
                donor_name="Rodrigo Salazar",
                channel="qr_bancario",
                amount_bs=Decimal(1500),
                status="anulado",
                cancellation_reason="No se encontró en el extracto",
                goal_id=goal.id,
                date=today - timedelta(days=4),
                **reviewed,
            ),
        ]
    )
    return "Meta de donaciones visible y 6 aportes (2 por confirmar)"


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


# Materiales del diseño (pág. 11)
INVENTORY = [
    {
        "name": "Colchonetas",
        "category": "fisioterapia",
        "quantity": 12,
        "condition": "bueno",
        "origin": "alcaldia",
        "donor_or_institution": "Gobierno Municipal",
        "code": "FIS-001",
    },
    {
        "name": "Pelotas de terapia 65 cm",
        "category": "fisioterapia",
        "quantity": 6,
        "condition": "nuevo",
        "origin": "donado",
        "donor_or_institution": "Grupo de exalumnos",
    },
    {
        "name": "Bastones",
        "category": "movilidad",
        "quantity": 8,
        "condition": "nuevo",
        "origin": "donado",
        "donor_or_institution": "Familia Rojas",
    },
    {
        "name": "Hojas y cartulinas",
        "category": "papeleria",
        "quantity": 40,
        "condition": "bueno",
        "origin": "propio",
        "donor_or_institution": "ASPAR",
    },
    {
        "name": "Sillas plegables",
        "category": "mobiliario",
        "quantity": 15,
        "condition": "bueno",
        "origin": "alcaldia",
        "donor_or_institution": "Gobierno Municipal",
        "code": "MOB-001",
    },
    {
        "name": "Banda elástica",
        "category": "fisioterapia",
        "quantity": 2,
        "condition": "dañado",
        "origin": "propio",
        "donor_or_institution": "ASPAR",
    },
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
