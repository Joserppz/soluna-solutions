import uuid

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.modules.evaluations.models import PatientEvaluation


def list_for_patient(
    db: Session, patient_id: uuid.UUID, area: str | None = None
) -> list[PatientEvaluation]:
    query = (
        select(PatientEvaluation)
        .where(PatientEvaluation.patient_id == patient_id)
        .order_by(
            PatientEvaluation.evaluated_on.desc(),
            PatientEvaluation.created_at.desc(),
            PatientEvaluation.id,
        )
    )
    if area:
        query = query.where(PatientEvaluation.area == area)
    return list(db.scalars(query))


def get(db: Session, patient_id: uuid.UUID, evaluation_id: uuid.UUID) -> PatientEvaluation | None:
    return db.scalar(
        select(PatientEvaluation).where(
            PatientEvaluation.id == evaluation_id, PatientEvaluation.patient_id == patient_id
        )
    )


def add(db: Session, evaluation: PatientEvaluation) -> PatientEvaluation:
    db.add(evaluation)
    db.flush()
    db.refresh(evaluation)
    return evaluation
