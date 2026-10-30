import uuid

from sqlalchemy import func, or_, select
from sqlalchemy.orm import Session

from app.modules.patients.models import Patient


def list_patients(
    db: Session,
    search: str | None = None,
    access_status: str | None = None,
    include_inactive: bool = False,
) -> list[Patient]:
    query = select(Patient).order_by(Patient.created_at.desc())
    if not include_inactive:
        query = query.where(Patient.deleted_at.is_(None))
    if search:
        pattern = f"%{search.strip().lower()}%"
        query = query.where(or_(func.lower(Patient.name).like(pattern), Patient.ci.like(pattern)))
    if access_status:
        query = query.where(Patient.access_status == access_status)
    return list(db.scalars(query))


def get_by_id(db: Session, patient_id: uuid.UUID) -> Patient | None:
    return db.get(Patient, patient_id)


def get_by_ci(db: Session, ci: str) -> Patient | None:
    return db.scalar(select(Patient).where(func.lower(Patient.ci) == ci.strip().lower()))


def add(db: Session, patient: Patient) -> Patient:
    db.add(patient)
    db.flush()
    db.refresh(patient)
    return patient
