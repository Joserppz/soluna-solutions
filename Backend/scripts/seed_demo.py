"""Datos de demostración para desarrollo y pruebas. Bloqueado en producción (ENV=prod).

Crea una cuenta por rol, una cuenta pendiente de aprobación, algunos afiliados de
ejemplo y una comunidad de afiliados para ver pestañas, filtros y páginas del listado.
Es idempotente: lo que ya existe no se vuelve a crear.

Uso (desde la carpeta Backend; con Docker: docker compose exec api python -m scripts.seed_demo):
    python -m scripts.seed_demo

Las contraseñas de abajo son públicas: nunca uses este script en la base de producción.
"""

import sys
from datetime import UTC, date, datetime, time, timedelta
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
    Inquiry,
    InquiryNote,
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
from app.modules.patients.models import PARKINSON_STAGES
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
    created.append(_inquiries(db, coordinator, schedules[1]))
    db.flush()
    return created


# Comunidad de ejemplo para el listado de afiliados (diseño pág. 8): nombre, carnet,
# año de nacimiento, zona, consentimiento, uso de imagen, alta (años y meses atrás),
# contacto principal, actividades a las que vino y motivo de baja si dejó de venir.
COMMUNITY = [
    (
        "Alba Gutiérrez Mamani",
        "4821557",
        1958,
        "Miraflores",
        True,
        True,
        (2, 7),
        ("Rosa Gutiérrez", "Hija", "76559012"),
        ("fisioterapia", "arteterapia"),
        None,
    ),
    (
        "Bernardo Mamani Quispe",
        "6104223",
        1952,
        "Villa Fátima",
        True,
        False,
        (1, 4),
        ("Julia Choque", "Esposa", "70144587"),
        ("fisioterapia",),
        None,
    ),
    (
        "Celia Flores Ticona",
        "3990418",
        1949,
        "Sopocachi",
        False,
        False,
        (1, 2),
        ("Mario Flores", "Hijo", "72015566"),
        ("arteterapia", "familias"),
        None,
    ),
    (
        "Darío Apaza Limachi",
        "2775901",
        1947,
        "El Alto",
        True,
        True,
        (3, 9),
        ("Lidia Apaza", "Hermana", "73300218"),
        ("fisioterapia",),
        "Se mudó con su familia a Cochabamba",
    ),
    (
        "Elena Quisbert Rojas",
        "7311064",
        1960,
        "Obrajes",
        False,
        False,
        (0, 0),
        ("Pedro Quisbert", "Esposo", "71188290"),
        ("fisioterapia",),
        None,
    ),
    (
        "Fausto Rojas Calle",
        "5208773",
        1955,
        "San Pedro",
        True,
        True,
        (2, 5),
        ("Ana Rojas", "Nieta", "77712345"),
        ("teatro",),
        None,
    ),
    (
        "Hortensia Vargas Pinto",
        "3401128",
        1951,
        "Achumani",
        True,
        True,
        (1, 10),
        ("Jorge Vargas", "Hijo", "70345678"),
        ("fisioterapia", "fonoaudiologia"),
        None,
    ),
    (
        "Ignacio Torrez Huanca",
        "6620045",
        1957,
        "Villa Copacabana",
        True,
        False,
        (1, 1),
        ("Marta Huanca", "Esposa", "71456789"),
        ("teatro", "familias"),
        None,
    ),
    (
        "Juana Choque Mendoza",
        "4105532",
        1946,
        "Calacoto",
        True,
        True,
        (3, 2),
        ("Sonia Choque", "Hija", "72567890"),
        ("arteterapia",),
        None,
    ),
    (
        "Leonardo Paz Arce",
        "5872210",
        1954,
        "Irpavi",
        True,
        True,
        (0, 8),
        ("Teresa Arce", "Esposa", "73678901"),
        ("fisioterapia", "teatro"),
        None,
    ),
    (
        "María Luisa Cruz",
        "3150987",
        1950,
        "Sopocachi",
        True,
        True,
        (2, 1),
        ("Elsa Poma", "Cuidadora", "74789012"),
        ("fonoaudiologia",),
        None,
    ),
    (
        "Nicanor Aliaga Ríos",
        "2988341",
        1944,
        "Miraflores",
        True,
        False,
        (4, 0),
        ("René Aliaga", "Hijo", "75890123"),
        (),
        "Falleció en agosto; la familia sigue en contacto",
    ),
    (
        "Olga Medina Vera",
        "6431179",
        1959,
        "Villa Armonía",
        False,
        False,
        (0, 1),
        ("Carla Medina", "Hija", "76901234"),
        (),
        None,
    ),
    (
        "Pablo Siñani Coaquira",
        "5009812",
        1953,
        "Alto Obrajes",
        True,
        True,
        (1, 6),
        ("Rosario Coaquira", "Esposa", "77012345"),
        ("fisioterapia", "familias"),
        None,
    ),
    (
        "Rosa Ticona Mamani",
        "4567321",
        1948,
        "Villa Fátima",
        True,
        True,
        (2, 11),
        ("Edwin Ticona", "Sobrino", "78123456"),
        ("arteterapia", "teatro"),
        None,
    ),
    (
        "Simón Laura Gemio",
        "6239904",
        1956,
        "Achachicala",
        True,
        False,
        (0, 6),
        ("Inés Gemio", "Esposa", "70234567"),
        ("fisioterapia",),
        None,
    ),
    (
        "Teresa Callisaya Poma",
        "3877456",
        1945,
        "Pampahasi",
        True,
        True,
        (3, 6),
        ("Daniel Callisaya", "Nieto", "71345678"),
        ("familias",),
        None,
    ),
    (
        "Víctor Huarachi Lima",
        "5544210",
        1961,
        "Següencoma",
        True,
        True,
        (0, 4),
        ("Nora Lima", "Hermana", "72456789"),
        ("fisioterapia", "fonoaudiologia", "teatro"),
        None,
    ),
    (
        "Wilma Condori Salas",
        "4732098",
        1952,
        "Cota Cota",
        True,
        True,
        (1, 8),
        ("Hugo Condori", "Esposo", "73567890"),
        ("arteterapia",),
        None,
    ),
    (
        "Zenón Mamani Copa",
        "2654310",
        1943,
        "Villa San Antonio",
        True,
        False,
        (2, 9),
        ("Felipa Copa", "Esposa", "74678901"),
        (),
        "Ahora lo acompañan en casa; pidió volver más adelante",
    ),
]

# Encuentros pasados de la comunidad: categoría, título y semanas atrás (sábados)
COMMUNITY_MEETINGS = [
    ("fisioterapia", "Movimiento en compañía", 2),
    ("arteterapia", "Arteterapia: crear juntos", 3),
    ("teatro", "Teatro y expresión", 5),
    ("familias", "Encuentro de familias", 6),
    ("fonoaudiologia", "Voz y lectura en grupo", 8),
]


def seed_community(db: Session) -> list[str]:
    """Afiliados de ejemplo con distintos estados y actividades, si todavía no están.

    Va aparte de seed() (que usan las pruebas con sus tres afiliados conocidos) y se
    agrega también a una base ya cargada al volver a ejecutar el script."""
    if settings.is_prod:
        raise SeedBlockedError("seed_demo está bloqueado en producción (ENV=prod).")
    if db.scalar(select(Patient.id).where(Patient.ci == COMMUNITY[0][1])) is not None:
        return []
    today = clock.today()
    now = clock.now()
    last_saturday = today - timedelta(days=(today.weekday() - 5) % 7)
    professional = user_repository.get_by_email(db, DEMO_USERS[PROFESSIONAL][1])
    meetings = {
        category: Schedule(
            title=title,
            category=category,
            date=last_saturday - timedelta(weeks=weeks),
            start_time=time(10),
            end_time=time(11, 30),
            location="Sede ASPAR",
            professional_name=professional.name if professional else "",
            description="Encuentro de la comunidad.",
            status="publicada",
        )
        for category, title, weeks in COMMUNITY_MEETINGS
    }
    db.add_all(meetings.values())

    patients = []
    for name, ci, born, zone, consent, image, (
        years,
        months,
    ), contact, activities, reason in COMMUNITY:
        joined = today.replace(day=1) - timedelta(days=365 * years + 30 * months)
        patient = Patient(
            name=name,
            ci=ci,
            birth_date=date(born, 1 + len(name) % 12, 1 + len(ci) * 2),
            phone=f"7{ci[-7:]}",
            address=f"Zona {zone}",
            zone=zone,
            consent=consent,
            consent_date=joined if consent else None,
            image_consent=consent and image,
            access_status="Activo" if consent else "Pendiente",
            diagnosis="Enfermedad de Parkinson",
            stage=PARKINSON_STAGES[len(patients) % 3],
            neurologist_certificate=consent,
            created_at=datetime(joined.year, joined.month, joined.day, 14, tzinfo=UTC),
            deleted_at=now if reason else None,
            deactivation_reason=reason,
            contacts=[
                PatientContact(
                    name=contact[0], relation=contact[1], phone=contact[2], is_primary=True
                )
            ],
        )
        patients.append((patient, activities))
        db.add(patient)
    db.flush()
    if professional:
        db.add_all(_evaluations(patients[0][0], professional))
    db.add_all(
        Attendance(
            schedule_id=meetings[category].id,
            patient_id=patient.id,
            status="vino",
            marked_by=professional.id if professional else None,
            marked_at=now,
        )
        for patient, activities in patients
        for category in activities
    )
    db.flush()
    return [
        f"{len(COMMUNITY)} afiliados de la comunidad (3 dados de baja, 2 sin consentimiento)",
        f"{len(COMMUNITY_MEETINGS)} encuentros pasados con su asistencia",
        f"3 evaluaciones de seguimiento de {COMMUNITY[0][0]}",
    ]


def _inquiries(db: Session, coordinator: User, next_saturday: Schedule) -> str:
    """Solicitudes del diseño (pág. 17): 4 nuevas y una contactada con su nota."""
    common = {"source": "sitio", "contact_consent": True}
    contacted = Inquiry(
        kind="orientacion",
        name="Hugo Torrez",
        phone="71198765",
        message="Consulta por actividades para su madre.",
        status="contactada",
        **common,
    )
    db.add_all(
        [
            Inquiry(
                kind="orientacion",
                name="Rosa Mamani",
                phone="71548214",
                on_behalf_of="Su esposo, Julio",
                zone="Villa Fátima",
                preferred_call_time="Por la tarde",
                message="Mi esposo casi no sale de la casa. ¿Podemos ir los dos los sábados?",
                **common,
            ),
            Inquiry(
                kind="voluntariado",
                name="Javier Condori",
                phone="70122334",
                message="Quiero ser voluntario los sábados.",
                **common,
            ),
            Inquiry(
                kind="especie",
                name="Elena Paredes",
                phone="76655443",
                message="Ofrezco una silla de ruedas en buen estado.",
                **common,
            ),
            Inquiry(
                kind="participar",
                name="Martha Villca",
                phone="72233445",
                schedule_id=next_saturday.id,
                **common,
            ),
            contacted,
        ]
    )
    db.flush()
    db.add(
        InquiryNote(
            inquiry_id=contacted.id,
            author_id=coordinator.id,
            author_name=coordinator.name,
            note="Se le explicó el horario del sábado; vendrá con su madre.",
        )
    )
    return "5 solicitudes (4 nuevas y una contactada)"


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
        # Las redes y el correo oficiales de ASPAR
        "redes_contacto": {
            "titulo": "",
            "facebook": "https://www.facebook.com/share/1DKFqHL1TD/",
            "instagram": "",
            "tiktok": "https://www.tiktok.com/@aspar_lapaz_bolivia",
            "whatsapp": "59168001551",
            "telefono": "",
            "correo": "asparlapaz@gmail.com",
            "direccion": "",
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
    return "Contenido publicado: Presentación, Misión y visión, y Redes y contacto"


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
        created += seed_community(db)
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
