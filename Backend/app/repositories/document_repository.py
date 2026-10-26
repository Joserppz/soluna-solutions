from sqlalchemy import select
from sqlalchemy.orm import Session

from app.models import PatientDocument


def list_for_patient(db: Session, patient_id: str) -> list[PatientDocument]:
    query = (
        select(PatientDocument)
        .where(PatientDocument.patient_id == patient_id)
        .order_by(PatientDocument.uploaded_at.desc())
    )
    return list(db.scalars(query))


def get_for_patient(db: Session, patient_id: str, document_id: str) -> PatientDocument | None:
    document = db.get(PatientDocument, document_id)
    return document if document is not None and document.patient_id == patient_id else None


def add(db: Session, document: PatientDocument) -> PatientDocument:
    db.add(document)
    db.flush()
    db.refresh(document)
    return document


def delete(db: Session, document: PatientDocument) -> None:
    db.delete(document)
    db.flush()
