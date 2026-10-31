"""Solicitudes desde el sitio y su seguimiento (RF-16, diseño págs. 2 y 17).

Llamar a tiempo es parte del acompañamiento: cada solicitud pasa de Nueva a Por
contactar y Contactada, con notas de cada llamada, hasta «Inscribir como afiliado»,
que abre la ficha con el nombre y el teléfono ya cargados. La bandeja no guarda
diagnósticos ni documentos médicos: eso vive en la ficha, con el consentimiento.
"""

import re
import uuid

from sqlalchemy.orm import Session

from app.core import clock
from app.core.errors import Conflict, NotFound, ValidationError
from app.core.pagination import PageParams, PageResult
from app.modules.audit import service as audit_service
from app.modules.auth.dependencies import CurrentUser
from app.modules.inquiries import repository as inquiry_repository
from app.modules.inquiries.models import (
    KIND_LABELS,
    STATUS_LABELS,
    STATUSES,
    TRANSITIONS,
    Inquiry,
    InquiryNote,
)
from app.modules.inquiries.schemas import InquiryConvert, PublicInquiryIn
from app.modules.patients import service as patient_service
from app.modules.patients.models import Patient
from app.modules.patients.schemas import ContactIn, PatientIn
from app.modules.schedules.models import Schedule
from app.modules.schedules.service import get_schedule
from app.modules.users import repository as user_repository

PHONE_PATTERN = re.compile(r"^\d{7,12}$")
NOT_FOUND = "Solicitud no encontrada."


def get_inquiry(db: Session, inquiry_id: uuid.UUID, lock: bool = False) -> Inquiry:
    inquiry = inquiry_repository.get(db, inquiry_id, lock)
    if inquiry is None:
        raise NotFound(NOT_FOUND)
    return inquiry


def list_inquiries(db: Session, page: PageParams, **filters) -> PageResult:
    return inquiry_repository.list_inquiries(db, page, **filters)


def summary(db: Session) -> dict[str, int]:
    counts = inquiry_repository.count_by_status(db)
    totals = {status: counts.get(status, 0) for status in STATUSES}
    return totals | {"total": sum(totals.values())}


def _audit(db: Session, current: CurrentUser, inquiry: Inquiry, action: str) -> None:
    audit_service.audit(
        db,
        current,
        category="SOLICITUDES",
        action=action,
        detail=f"{KIND_LABELS[inquiry.kind]} de {inquiry.name} ({inquiry.id}): "
        f"{STATUS_LABELS[inquiry.status]}",
    )


def create_public(db: Session, data: PublicInquiryIn) -> Inquiry:
    name, phone = data.name.strip(), data.phone.strip()
    if len(name) < 3:
        raise ValidationError("Escribe tu nombre (al menos 3 caracteres).")
    if not PHONE_PATTERN.match(phone):
        raise ValidationError("El teléfono debe tener entre 7 y 12 dígitos.")
    if not data.contact_consent:
        raise ValidationError("Necesitamos tu permiso para llamarte y responder tu solicitud.")
    schedule_id = None
    if data.kind == "participar":
        if data.schedule_id is None:
            raise ValidationError("Elige la actividad en la que quieres participar.")
        schedule = get_schedule(db, data.schedule_id)
        if schedule.status != "publicada" or schedule.date < clock.today():
            raise Conflict("Esa actividad ya no recibe inscripciones.")
        schedule_id = schedule.id
    inquiry = Inquiry(
        kind=data.kind,
        source="sitio",
        name=name,
        phone=phone,
        on_behalf_of=data.on_behalf_of.strip(),
        zone=data.zone.strip(),
        preferred_call_time=data.preferred_call_time.strip(),
        message=data.message.strip(),
        schedule_id=schedule_id,
        status="recibida",
        contact_consent=True,
    )
    db.add(inquiry)
    db.flush()
    db.refresh(inquiry)
    audit_service.record(
        db,
        actor=name,
        actor_role="Sitio público",
        category="SOLICITUDES",
        severity="INFO",
        action="Solicitud recibida desde el sitio",
        detail=f"{KIND_LABELS[inquiry.kind]} ({inquiry.id})",
    )
    return inquiry


def _note(db: Session, inquiry: Inquiry, current: CurrentUser, text: str) -> InquiryNote:
    note = InquiryNote(
        inquiry_id=inquiry.id,
        author_id=current.user.id,
        author_name=current.user.name,
        note=text,
        created_at=clock.now(),
    )
    db.add(note)
    return note


def _move(inquiry: Inquiry, status: str) -> None:
    if status == inquiry.status:
        return
    if status not in TRANSITIONS[inquiry.status]:
        raise Conflict(
            f"Una solicitud {STATUS_LABELS[inquiry.status].lower()} no puede pasar a "
            f"{STATUS_LABELS[status].lower()}."
        )
    inquiry.status = status


def update(db: Session, inquiry_id: uuid.UUID, changes: dict, current: CurrentUser) -> Inquiry:
    inquiry = get_inquiry(db, inquiry_id, lock=True)
    if "assigned_to" in changes:
        user_id = changes["assigned_to"]
        if user_id is not None:
            user = user_repository.get_by_id(db, user_id)
            if user is None or not user.active or user.role is None:
                raise ValidationError("Asigna la solicitud a una persona activa del equipo.")
            _note(db, inquiry, current, f"Asignó la solicitud a {user.name}.")
        inquiry.assigned_to = user_id
    if changes.get("status"):
        previous = inquiry.status
        _move(inquiry, changes["status"])
        if inquiry.status != previous:
            _note(db, inquiry, current, f"Cambió el estado a «{STATUS_LABELS[inquiry.status]}».")
    _audit(db, current, inquiry, "Actualización de solicitud")
    db.flush()
    return inquiry


def add_note(
    db: Session, inquiry_id: uuid.UUID, text: str, mark_contacted: bool, current: CurrentUser
) -> Inquiry:
    inquiry = get_inquiry(db, inquiry_id, lock=True)
    if not text.strip():
        raise ValidationError("Escribe la nota de la llamada.")
    if mark_contacted:
        _move(inquiry, "contactada")
    _note(db, inquiry, current, text.strip())
    _audit(db, current, inquiry, "Nota de seguimiento de solicitud")
    db.flush()
    return inquiry


def patient_draft(inquiry: Inquiry) -> dict:
    """Si escribió por otra persona, la ficha es de esa persona y quien escribió, su contacto."""
    if inquiry.on_behalf_of:
        return {
            "name": inquiry.on_behalf_of,
            "phone": inquiry.phone,
            "zone": inquiry.zone,
            "contacts": [
                ContactIn(
                    name=inquiry.name, relation="Familiar", phone=inquiry.phone, is_primary=True
                )
            ],
        }
    return {"name": inquiry.name, "phone": inquiry.phone, "zone": inquiry.zone, "contacts": []}


def convert_to_patient(
    db: Session, inquiry_id: uuid.UUID, data: InquiryConvert, current: CurrentUser
) -> Patient:
    """«Inscribir como afiliado»: ficha nueva (sin consentimiento aún) y solicitud inscrita."""
    inquiry = get_inquiry(db, inquiry_id, lock=True)
    if inquiry.patient_id is not None or inquiry.status == "inscrita":
        raise Conflict("Esta solicitud ya tiene una ficha de afiliado.")
    if inquiry.status == "cerrada":
        raise Conflict("La solicitud está cerrada: reábrela para inscribir a la persona.")
    draft = patient_draft(inquiry)
    contacts = data.contacts or draft["contacts"]
    if not contacts:
        raise ValidationError(
            "Toda ficha necesita al menos un contacto de apoyo (familiar o persona cuidadora)."
        )
    patient = patient_service.create_patient(
        db,
        PatientIn(
            name=data.name or draft["name"],
            ci=data.ci,
            birth_date=data.birth_date,
            phone=data.phone or draft["phone"],
            address=data.address,
            zone=data.zone if data.zone is not None else draft["zone"],
            consent=False,
            access_status="Pendiente",
            contacts=contacts,
        ),
        current,
    )
    inquiry.patient_id = patient.id
    inquiry.status = "inscrita"
    _note(db, inquiry, current, f"Inscribió a {patient.name} como afiliado (ficha nueva).")
    _audit(db, current, inquiry, "Inscripción de solicitud como afiliado")
    db.flush()
    return patient


def schedule_titles(db: Session, inquiries: list[Inquiry]) -> dict[uuid.UUID, str]:
    ids = {i.schedule_id for i in inquiries if i.schedule_id}
    return {s.id: s.title for s in (db.get(Schedule, sid) for sid in ids) if s}


def assignee_names(db: Session, inquiries: list[Inquiry]) -> dict[uuid.UUID, str]:
    ids = {i.assigned_to for i in inquiries if i.assigned_to}
    return {u.id: u.name for u in (user_repository.get_by_id(db, uid) for uid in ids) if u}
