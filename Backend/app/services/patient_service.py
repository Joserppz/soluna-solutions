"""Fichas de pacientes y anamnesis digital (RF-02) con reglas de consentimiento (RNF-06)."""

import re
import uuid
from datetime import UTC, date, datetime

from sqlalchemy.orm import Session

from app.core.constants import (
    ACCESS_STATUSES,
    CLINICAL_ONLY_COLUMNS,
    CLINICAL_ROLES,
    PARKINSON_STAGES,
)
from app.core.deps import CurrentUser
from app.core.errors import Conflict, Forbidden, NotFound, ValidationError
from app.models import Patient
from app.repositories import patient_repository
from app.schemas.patient import ClinicalAnamnesis, PatientIn, PatientUpdate
from app.services import audit_service

CI_PATTERN = re.compile(r"^\d{5,10}(-[0-9A-Za-z]{1,3})?$")
PHONE_PATTERN = re.compile(r"^\d{7,12}$")
DUPLICATE_CI = "Ya existe un paciente registrado con esa Cédula de Identidad."
NOT_FOUND = "Paciente no encontrado."


CLINICAL_DATA_FORBIDDEN = (
    "Solo el personal clínico (Administrador, Coordinador, Profesional) puede registrar "
    "síntomas, evaluaciones y medicación (RNF-06)."
)


def can_view_clinical_record(role: str, patient: Patient) -> bool:
    """Misma regla que canViewClinicalRecord() del frontend, aplicada en el servidor."""
    return role in CLINICAL_ROLES and patient.consent and patient.access_status == "Activo"


def _forbid_clinical_fields(db: Session, current: CurrentUser, columns: set[str]) -> None:
    if current.user.role in CLINICAL_ROLES or not columns & set(CLINICAL_ONLY_COLUMNS):
        return
    audit_service.audit(
        db,
        current,
        category="PACIENTES",
        severity="WARNING",
        action="Intento de registrar datos clínicos sin permiso",
        detail=f"El rol {current.user.role} intentó editar evaluaciones clínicas",
    )
    raise Forbidden(CLINICAL_DATA_FORBIDDEN, persist=True)


def validate_fields(
    *,
    name: str,
    ci: str,
    phone: str,
    emergency_contact: str,
    consent: bool,
    access_status: str,
    stage: str,
) -> None:
    """Mismas reglas que validatePatientInput() en Frontend/src/services/aspar.ts."""
    if len(name.strip()) < 3:
        raise ValidationError("El nombre completo debe tener al menos 3 caracteres.")
    if not CI_PATTERN.match(ci.strip()):
        raise ValidationError("La Cédula de Identidad debe contener entre 5 y 10 dígitos válidos.")
    if not PHONE_PATTERN.match(phone.strip()):
        raise ValidationError("El teléfono debe contener entre 7 y 12 dígitos numéricos.")
    if len(emergency_contact.strip()) < 3:
        raise ValidationError("El contacto de emergencia o cuidador es obligatorio.")
    if access_status not in ACCESS_STATUSES:
        raise ValidationError("El estado de acceso debe ser Activo, Pendiente o Revocado.")
    if stage not in PARKINSON_STAGES:
        raise ValidationError("El estadio clínico (Hoehn y Yahr) no es válido.")
    if access_status == "Activo" and not consent:
        raise ValidationError(
            "No se puede activar el acceso clínico sin consentimiento informado firmado (RNF-06)."
        )


def list_patients(db: Session, search: str | None, access_status: str | None) -> list[Patient]:
    return patient_repository.list_patients(db, search, access_status)


def get_patient(db: Session, patient_id: str) -> Patient:
    patient = patient_repository.get_by_id(db, patient_id)
    if patient is None:
        raise NotFound(NOT_FOUND)
    return patient


def view_patient(db: Session, patient_id: str, current: CurrentUser) -> tuple[Patient, bool]:
    """Consulta de una ficha; si se muestra la anamnesis, queda en la bitácora."""
    patient = get_patient(db, patient_id)
    clinical_access = can_view_clinical_record(current.user.role, patient)
    if clinical_access:
        audit_service.audit(
            db,
            current,
            category="PACIENTES",
            severity="INFO",
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
        emergency_contact=data.emergency_contact,
        consent=data.consent,
        access_status=data.access_status,
        stage=anamnesis.stage,
    )
    if patient_repository.get_by_ci(db, data.ci) is not None:
        raise Conflict(DUPLICATE_CI)

    now = datetime.now(UTC)
    patient = Patient(
        id=f"p-{uuid.uuid4().hex[:8]}",
        name=data.name.strip(),
        ci=data.ci.strip(),
        phone=data.phone.strip(),
        address=data.address.strip() or "La Paz, Bolivia",
        emergency_contact=data.emergency_contact.strip(),
        caregiver_relation=data.caregiver_relation.strip() or "Familiar / Cuidador",
        consent=data.consent,
        consent_date=(data.consent_date or date.today()) if data.consent else None,
        access_status=data.access_status,
        created_by=current.user.id,
        created_at=now,
        updated_at=now,
        **anamnesis.model_dump(),
    )
    patient_repository.add(db, patient)
    audit_service.audit(
        db,
        current,
        category="PACIENTES",
        severity="INFO",
        action="Registro de ficha y anamnesis de paciente",
        detail=f"Registró a {patient.name} (CI {patient.ci}) con estado {patient.access_status}",
    )
    return patient


def update_patient(
    db: Session, patient_id: str, data: PatientUpdate, current: CurrentUser
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

    for field, value in changes.items():
        setattr(patient, field, value.strip() if isinstance(value, str) else value)
    if data.anamnesis is not None:
        for field, value in data.anamnesis.model_dump(
            exclude_unset=True, exclude_none=True
        ).items():
            setattr(patient, field, value)

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
        emergency_contact=patient.emergency_contact,
        consent=patient.consent,
        access_status=patient.access_status,
        stage=patient.stage,
    )
    patient.updated_at = datetime.now(UTC)

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
            "Actualización de consentimiento / acceso de paciente"
            if consent_changed
            else "Actualización de ficha de paciente"
        ),
        detail=(
            f"Paciente {patient.name} ({patient.id}): consentimiento={patient.consent}, "
            f"acceso={patient.access_status}"
        ),
    )
    db.flush()
    db.refresh(patient)
    return patient


def delete_patient(db: Session, patient_id: str, current: CurrentUser) -> None:
    patient = get_patient(db, patient_id)
    patient_repository.delete(db, patient)
    audit_service.audit(
        db,
        current,
        category="PACIENTES",
        severity="CRITICAL",
        action="Eliminación de ficha de paciente",
        detail=f"Eliminó la ficha de {patient.name} (CI {patient.ci}, {patient.id})",
    )
