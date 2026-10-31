import uuid

from sqlalchemy import func, or_, select
from sqlalchemy.orm import Session

from app.core.database import escape_like
from app.core.pagination import PageParams, PageResult, paginate
from app.modules.patients.models import Patient


def list_patients(
    db: Session,
    search: str | None = None,
    access_status: str | None = None,
    include_inactive: bool = False,
    page: PageParams | None = None,
) -> PageResult:
    # El id al final da un orden total: las páginas no repiten ni saltan fichas
    query = select(Patient).order_by(Patient.created_at.desc(), Patient.id.desc())
    if not include_inactive:
        query = query.where(Patient.deleted_at.is_(None))
    if search:
        pattern = f"%{escape_like(search.strip())}%"
        query = query.where(
            or_(Patient.name.ilike(pattern, escape="\\"), Patient.ci.ilike(pattern, escape="\\"))
        )
    if access_status:
        query = query.where(Patient.access_status == access_status)
    return paginate(db, query, page or PageParams())


def get_by_id(db: Session, patient_id: uuid.UUID) -> Patient | None:
    return db.get(Patient, patient_id)


def get_by_ci(db: Session, ci: str) -> Patient | None:
    return db.scalar(select(Patient).where(func.lower(Patient.ci) == ci.strip().lower()))


def add(db: Session, patient: Patient) -> Patient:
    db.add(patient)
    db.flush()
    db.refresh(patient)
    return patient
