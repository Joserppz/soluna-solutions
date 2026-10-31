"""Fichas de afiliados y anamnesis base (RF-02) con reglas de consentimiento (RNF-06)."""

import re
import uuid
from datetime import UTC, date, datetime

from sqlalchemy.orm import Session

from app.core.errors import Conflict, Forbidden, NotFound, ValidationError
from app.core.pagination import PageParams, PageResult
from app.modules.audit import service as audit_service
from app.modules.auth.dependencies import CurrentUser
from app.modules.patients import repository as patient_repository
from app.modules.patients.models import (
    ACCESS_STATUSES,
    CLINICAL_ONLY_COLUMNS,
    PARKINSON_STAGES,
    Patient,
    PatientContact,
)
from app.modules.patients.schemas import (
    ClinicalAnamnesis,
    ContactIn,
    ContactUpdate,
    PatientIn,
    PatientUpdate,
)
from app.modules.users.models import PATIENTS_READ_CLINICAL, PATIENTS_WRITE_CLINICAL

CI_PATTERN = re.compile(r"^\d{5,10}(-[0-9A-Za-z]{1,3})?$")
PHONE_PATTERN = re.compile(r"^\d{7,12}$")
DUPLICATE_CI = "Ya existe un afiliado registrado con esa Cédula de Identidad."
NOT_FOUND = "Afiliado no encontrado."
CONTACT_NOT_FOUND = "Familiar o persona cuidadora no encontrado."
MAX_ACTIVE_CONTACTS = 5
CLINICAL_DATA_FORBIDDEN = (
    "Tu rol no tiene permiso para registrar síntomas y medicación (datos clínicos, RNF-06)."
)


def can_view_clinical_record(current: CurrentUser, patient: Patient) -> bool:
    """RNF-06: permiso clínico Y consentimiento firmado Y acceso Activo.

    La regla del consentimiento no depende de los permisos: aunque Administración dé el
    permiso clínico a otro rol, sin consentimiento y acceso Activo nadie ve la anamnesis.
    """
    return (
        current.can(PATIENTS_READ_CLINICAL)
        and patient.consent
        and patient.access_status == "Activo"
    )


def _forbid_clinical_fields(db: Session, current: CurrentUser, columns: set[str]) -> None:
    if current.can(PATIENTS_WRITE_CLINICAL) or not columns & set(CLINICAL_ONLY_COLUMNS):
        return
    audit_service.audit(
        db,
        current,
        category="PACIENTES",
        severity="WARNING",
        action="Intento de registrar datos clínicos sin permiso",
        detail=f"El rol {current.user.role_name} intentó registrar síntomas o medicación",
    )
    raise Forbidden(CLINICAL_DATA_FORBIDDEN, persist=True)


def validate_fields(
    *, name: str, ci: str, phone: str, consent: bool, access_status: str, stage: str
) -> None:
    if len(name.strip()) < 3:
        raise ValidationError("El nombre completo debe tener al menos 3 caracteres.")
    if not CI_PATTERN.match(ci.strip()):
        raise ValidationError("La Cédula de Identidad debe contener entre 5 y 10 dígitos válidos.")
    if not PHONE_PATTERN.match(phone.strip()):
        raise ValidationError("El teléfono debe contener entre 7 y 12 dígitos numéricos.")
    if access_status not in ACCESS_STATUSES:
        raise ValidationError("El estado de acceso debe ser Activo, Pendiente o Revocado.")
    if stage not in PARKINSON_STAGES:
        raise ValidationError("El estadio clínico (Hoehn y Yahr) no es válido.")
    if access_status == "Activo" and not consent:
        raise ValidationError(
            "No se puede activar el acceso clínico sin consentimiento informado firmado (RNF-06)."
        )


def validate_contact(contact: ContactIn) -> None:
    if len(contact.name.strip()) < 3:
        raise ValidationError("El nombre del familiar o cuidador debe tener al menos 3 caracteres.")
    if len(contact.relation.strip()) < 2:
        raise ValidationError("Indica la relación del familiar o cuidador con el afiliado.")
    for phone in (contact.phone, contact.alt_phone):
        if phone is not None and not PHONE_PATTERN.match(phone.strip()):
            raise ValidationError(
                "El teléfono del familiar debe contener entre 7 y 12 dígitos numéricos."
            )


def new_contacts(contacts: list[ContactIn]) -> list[PatientContact]:
    for contact in contacts:
        validate_contact(contact)
    primary_index = next((i for i, c in enumerate(contacts) if c.is_primary), 0)
    return [
        PatientContact(
            name=contact.name.strip(),
            relation=contact.relation.strip(),
            phone=contact.phone.strip(),
            alt_phone=contact.alt_phone.strip() if contact.alt_phone else None,
            # Exactamente un contacto principal
            is_primary=index == primary_index,
            active=True,
        )
        for index, contact in enumerate(contacts)
    ]


def list_patients(
    db: Session,
    search: str | None,
    access_status: str | None,
    include_inactive: bool = False,
    page: PageParams | None = None,
) -> PageResult:
    return patient_repository.list_patients(db, search, access_status, include_inactive, page)


def get_patient(db: Session, patient_id: uuid.UUID) -> Patient:
    patient = patient_repository.get_by_id(db, patient_id)
    if patient is None:
        raise NotFound(NOT_FOUND)
    return patient


def view_patient(db: Session, patient_id: uuid.UUID, current: CurrentUser) -> tuple[Patient, bool]:
    """Consulta de una ficha; si se muestra la anamnesis, queda en la bitácora."""
    patient = get_patient(db, patient_id)
    clinical_access = can_view_clinical_record(current, patient)
    if clinical_access:
        audit_service.audit(
            db,
            current,
            category="PACIENTES",
            action="Consulta de ficha clínica",
            detail=f"Consultó la anamnesis de {patient.name} ({patient.id})",
        )
    return patient, clinical_access


def create_patient(db: Session, data: PatientIn, current: CurrentUser) -> Patient:
    anamnesis = data.anamnesis or ClinicalAnamnesis()
    _forbid_clinical_fields(
        db, current, {column for column, value in anamnesis.model_dump().items() if value}
    )
    validate_fields(
        name=data.name,
        ci=data.ci,
        phone=data.phone,
        consent=data.consent,
        access_status=data.access_status,
        stage=anamnesis.stage,
    )
    contacts = new_contacts(data.contacts)
    if patient_repository.get_by_ci(db, data.ci) is not None:
        raise Conflict(DUPLICATE_CI)

    patient = patient_repository.add(
        db,
        Patient(
            name=data.name.strip(),
            ci=data.ci.strip(),
            birth_date=data.birth_date,
            phone=data.phone.strip(),
            address=data.address.strip(),
            zone=data.zone.strip(),
            consent=data.consent,
            consent_date=(data.consent_date or date.today()) if data.consent else None,
            image_consent=data.image_consent,
            access_status=data.access_status,
            created_by=current.user.id,
            contacts=contacts,
            **anamnesis.model_dump(),
        ),
    )
    audit_service.audit(
        db,
        current,
        category="PACIENTES",
        action="Registro de ficha y anamnesis de afiliado",
        detail=f"Registró a {patient.name} (CI {patient.ci}) con estado {patient.access_status}",
    )
    return patient


def update_patient(
    db: Session, patient_id: uuid.UUID, data: PatientUpdate, current: CurrentUser
) -> Patient:
    patient = get_patient(db, patient_id)
    anamnesis_changes = (
        data.anamnesis.model_dump(exclude_unset=True, exclude_none=True) if data.anamnesis else {}
    )
    _forbid_clinical_fields(db, current, set(anamnesis_changes))
    changes = data.model_dump(exclude_unset=True, exclude_none=True, exclude={"anamnesis"})
    previous_consent, previous_access = patient.consent, patient.access_status

    new_ci = changes.get("ci", patient.ci).strip()
    if (
        new_ci.lower() != patient.ci.lower()
        and patient_repository.get_by_ci(db, new_ci) is not None
    ):
        raise Conflict(DUPLICATE_CI)

    for field, value in (changes | anamnesis_changes).items():
        setattr(patient, field, value.strip() if isinstance(value, str) else value)

    # RNF-06: sin consentimiento vigente el acceso no puede quedar Activo
    if not patient.consent:
        patient.consent_date = None
        if patient.access_status == "Activo":
            patient.access_status = "Pendiente"
    elif patient.consent_date is None:
        patient.consent_date = date.today()

    validate_fields(
        name=patient.name,
        ci=patient.ci,
        phone=patient.phone,
        consent=patient.consent,
        access_status=patient.access_status,
        stage=patient.stage,
    )

    consent_changed = (patient.consent, patient.access_status) != (
        previous_consent,
        previous_access,
    )
    revoked = patient.access_status == "Revocado" or not patient.consent
    audit_service.audit(
        db,
        current,
        category="CONSENTIMIENTO" if consent_changed else "PACIENTES",
        severity="WARNING" if consent_changed and revoked else "INFO",
        action=(
            "Actualización de consentimiento / acceso de afiliado"
            if consent_changed
            else "Actualización de ficha de afiliado"
        ),
        detail=(
            f"Afiliado {patient.name} ({patient.id}): consentimiento={patient.consent}, "
            f"acceso={patient.access_status}"
        ),
    )
    db.flush()
    db.refresh(patient)
    return patient


def deactivate_patient(
    db: Session, patient_id: uuid.UUID, reason: str, current: CurrentUser
) -> Patient:
    """Baja lógica: la ficha, sus evaluaciones y documentos se conservan."""
    patient = get_patient(db, patient_id)
    if not patient.active:
        raise Conflict("La ficha ya está dada de baja.")
    patient.deleted_at = datetime.now(UTC)
    patient.deactivation_reason = reason.strip()
    patient.deactivated_by = current.user.id
    audit_service.audit(
        db,
        current,
        category="PACIENTES",
        severity="WARNING",
        action="Baja de ficha de afiliado",
        detail=(
            f"Dio de baja a {patient.name} ({patient.id}). Motivo: {patient.deactivation_reason}"
        ),
    )
    db.flush()
    db.refresh(patient)
    return patient


def reactivate_patient(db: Session, patient_id: uuid.UUID, current: CurrentUser) -> Patient:
    patient = get_patient(db, patient_id)
    if patient.active:
        raise Conflict("La ficha ya está activa.")
    patient.deleted_at = None
    patient.deactivation_reason = None
    patient.deactivated_by = None
    audit_service.audit(
        db,
        current,
        category="PACIENTES",
        action="Reactivación de ficha de afiliado",
        detail=f"Reactivó la ficha de {patient.name} ({patient.id})",
    )
    db.flush()
    db.refresh(patient)
    return patient


# ---------------------------------------------------------------------------
# Familiares y personas cuidadoras (diseño pág. 9): 1 a 5 activos, uno principal
# ---------------------------------------------------------------------------
def _contact(patient: Patient, contact_id: uuid.UUID) -> PatientContact:
    contact = next((c for c in patient.active_contacts if c.id == contact_id), None)
    if contact is None:
        raise NotFound(CONTACT_NOT_FOUND)
    return contact


def _make_primary(db: Session, patient: Patient, contact: PatientContact) -> None:
    # Primero se quita el principal anterior: el índice único admite uno solo por ficha
    for other in patient.active_contacts:
        if other is not contact and other.is_primary:
            other.is_primary = False
    db.flush()
    contact.is_primary = True


def _audit_contact(db: Session, current: CurrentUser, patient: Patient, action: str, who: str):
    audit_service.audit(
        db,
        current,
        category="PACIENTES",
        action=action,
        detail=f"{who} en la ficha de {patient.name} ({patient.id})",
    )


def add_contact(
    db: Session, patient_id: uuid.UUID, data: ContactIn, current: CurrentUser
) -> PatientContact:
    patient = get_patient(db, patient_id)
    validate_contact(data)
    if len(patient.active_contacts) >= MAX_ACTIVE_CONTACTS:
        raise Conflict(f"Una ficha admite hasta {MAX_ACTIVE_CONTACTS} familiares o cuidadores.")
    contact = PatientContact(
        name=data.name.strip(),
        relation=data.relation.strip(),
        phone=data.phone.strip(),
        alt_phone=data.alt_phone.strip() if data.alt_phone else None,
        is_primary=False,
        active=True,
    )
    patient.contacts.append(contact)
    db.flush()
    if data.is_primary or not any(c.is_primary for c in patient.active_contacts):
        _make_primary(db, patient, contact)
    _audit_contact(db, current, patient, "Registro de familiar o cuidador", contact.name)
    db.flush()
    return contact


def update_contact(
    db: Session,
    patient_id: uuid.UUID,
    contact_id: uuid.UUID,
    data: ContactUpdate,
    current: CurrentUser,
) -> PatientContact:
    patient = get_patient(db, patient_id)
    contact = _contact(patient, contact_id)
    changes = data.model_dump(exclude_unset=True)
    make_primary = changes.pop("is_primary", None)
    if make_primary is False and contact.is_primary:
        raise Conflict("Toda ficha necesita un contacto principal: marca otro como principal.")

    def pick(field: str) -> str | None:
        # Los campos no enviados conservan su valor; un valor vacío se valida como vacío
        return (changes.get(field) or "") if field in changes else getattr(contact, field)

    merged = ContactIn(
        name=pick("name"),
        relation=pick("relation"),
        phone=pick("phone"),
        alt_phone=pick("alt_phone") or None,  # vacío quita el teléfono alterno
    )
    validate_contact(merged)
    contact.name = merged.name.strip()
    contact.relation = merged.relation.strip()
    contact.phone = merged.phone.strip()
    contact.alt_phone = merged.alt_phone.strip() if merged.alt_phone else None
    if make_primary:
        _make_primary(db, patient, contact)
    _audit_contact(db, current, patient, "Actualización de familiar o cuidador", contact.name)
    db.flush()
    return contact


def remove_contact(
    db: Session, patient_id: uuid.UUID, contact_id: uuid.UUID, current: CurrentUser
) -> None:
    """Baja lógica del contacto: se conserva en la base, pero deja de mostrarse."""
    patient = get_patient(db, patient_id)
    contact = _contact(patient, contact_id)
    if len(patient.active_contacts) == 1:
        raise Conflict(
            "Toda ficha necesita al menos un contacto de apoyo: agrega otro antes de quitar este."
        )
    was_primary = contact.is_primary
    contact.active = False
    contact.is_primary = False
    db.flush()
    if was_primary:
        _make_primary(db, patient, patient.active_contacts[0])
    _audit_contact(db, current, patient, "Baja de familiar o cuidador", contact.name)
    db.flush()
