"""Evaluaciones de seguimiento: Física, Fonoaudiológica y Psicológica (diseño pág. 9).

Son datos clínicos: verlas exige el permiso clínico Y la regla de consentimiento
(RNF-06), igual que la anamnesis y los documentos. Las evaluaciones no se borran:
una corrección queda en la bitácora con los campos que cambiaron.
"""

import uuid
from datetime import date

from sqlalchemy.orm import Session

from app.core import clock
from app.core.errors import Forbidden, NotFound, ValidationError
from app.modules.audit import service as audit_service
from app.modules.auth.dependencies import CurrentUser, load_permissions
from app.modules.evaluations import repository as evaluation_repository
from app.modules.evaluations.models import AREA_LABELS, PatientEvaluation
from app.modules.evaluations.schemas import EvaluationIn, EvaluationUpdate
from app.modules.patients.models import Patient
from app.modules.patients.service import can_view_clinical_record, get_patient
from app.modules.users import repository as user_repository
from app.modules.users.models import PATIENTS_WRITE_CLINICAL

NO_CLINICAL_ACCESS = (
    "Las evaluaciones de esta ficha no están disponibles: falta el consentimiento firmado o "
    "el acceso no está Activo (RNF-06)."
)
NOT_FOUND = "Evaluación no encontrada."
OLDEST_DATE = date(2000, 1, 1)


def _patient(db: Session, patient_id: uuid.UUID, current: CurrentUser) -> Patient:
    patient = get_patient(db, patient_id)
    if not can_view_clinical_record(current, patient):
        raise Forbidden(NO_CLINICAL_ACCESS)
    return patient


def _validate_date(evaluated_on: date) -> None:
    if evaluated_on > clock.today():
        raise ValidationError("La fecha de la evaluación no puede ser futura.")
    if evaluated_on < OLDEST_DATE:
        raise ValidationError("Revisa la fecha de la evaluación.")


def _validate_notes(notes: str) -> None:
    if len(notes.strip()) < 3:
        raise ValidationError("Escribe las observaciones de la evaluación.")


def _professional(
    db: Session,
    professional_id: uuid.UUID | None,
    professional_name: str | None,
    current: CurrentUser,
) -> tuple[uuid.UUID | None, str]:
    """Quién revisó: una cuenta del personal clínico, un nombre externo o quien registra."""
    if professional_id is not None:
        user = user_repository.get_by_id(db, professional_id)
        if user is None or not user.active:
            raise ValidationError("La persona que revisó no existe o está desactivada.")
        if PATIENTS_WRITE_CLINICAL not in load_permissions(db, user):
            raise ValidationError("La persona que revisó debe ser parte del personal clínico.")
        return user.id, user.name
    if professional_name is not None:
        name = professional_name.strip()
        if len(name) < 3:
            raise ValidationError("Indica el nombre del profesional que revisó.")
        return None, name
    return current.user.id, current.user.name


def _audit(
    db: Session, current: CurrentUser, patient: Patient, severity: str, action: str, detail: str
) -> None:
    audit_service.audit(
        db,
        current,
        category="PACIENTES",
        severity=severity,
        action=action,
        detail=f"{detail} de {patient.name} ({patient.id})",
    )


def list_evaluations(
    db: Session, patient_id: uuid.UUID, area: str | None, current: CurrentUser
) -> list[PatientEvaluation]:
    patient = _patient(db, patient_id, current)
    _audit(db, current, patient, "INFO", "Consulta de evaluaciones", "Consultó las evaluaciones")
    return evaluation_repository.list_for_patient(db, patient.id, area)


def get_evaluation(
    db: Session, patient_id: uuid.UUID, evaluation_id: uuid.UUID, current: CurrentUser
) -> PatientEvaluation:
    patient = _patient(db, patient_id, current)
    evaluation = evaluation_repository.get(db, patient.id, evaluation_id)
    if evaluation is None:
        raise NotFound(NOT_FOUND)
    _audit(db, current, patient, "INFO", "Consulta de evaluaciones", "Consultó una evaluación")
    return evaluation


def create_evaluation(
    db: Session, patient_id: uuid.UUID, data: EvaluationIn, current: CurrentUser
) -> PatientEvaluation:
    patient = _patient(db, patient_id, current)
    _validate_date(data.evaluated_on)
    _validate_notes(data.notes)
    professional_id, professional_name = _professional(
        db, data.professional_id, data.professional_name, current
    )
    evaluation = evaluation_repository.add(
        db,
        PatientEvaluation(
            patient_id=patient.id,
            area=data.area,
            evaluated_on=data.evaluated_on,
            professional_id=professional_id,
            professional_name=professional_name,
            notes=data.notes.strip(),
            created_by=current.user.id,
        ),
    )
    _audit(
        db,
        current,
        patient,
        "INFO",
        "Registro de evaluación de seguimiento",
        f"Registró una evaluación {AREA_LABELS[data.area]} del {data.evaluated_on:%d/%m/%Y}",
    )
    return evaluation


def update_evaluation(
    db: Session,
    patient_id: uuid.UUID,
    evaluation_id: uuid.UUID,
    data: EvaluationUpdate,
    current: CurrentUser,
) -> PatientEvaluation:
    patient = _patient(db, patient_id, current)
    evaluation = evaluation_repository.get(db, patient.id, evaluation_id)
    if evaluation is None:
        raise NotFound(NOT_FOUND)
    changes = data.model_dump(exclude_unset=True)
    for field in ("area", "evaluated_on", "notes"):
        if field in changes and changes[field] is None:
            raise ValidationError("No se puede dejar vacío un dato de la evaluación.")

    if "evaluated_on" in changes:
        _validate_date(changes["evaluated_on"])
    if "notes" in changes:
        _validate_notes(changes["notes"])
    if "professional_id" in changes or "professional_name" in changes:
        evaluation.professional_id, evaluation.professional_name = _professional(
            db, changes.get("professional_id"), changes.get("professional_name"), current
        )
    for field in ("area", "evaluated_on"):
        if field in changes:
            setattr(evaluation, field, changes[field])
    if "notes" in changes:
        evaluation.notes = changes["notes"].strip()

    _audit(
        db,
        current,
        patient,
        "WARNING",
        "Corrección de evaluación",
        f"Corrigió {', '.join(sorted(changes)) or 'nada'} en una evaluación "
        f"{AREA_LABELS[evaluation.area]}",
    )
    db.flush()
    db.refresh(evaluation)
    return evaluation
