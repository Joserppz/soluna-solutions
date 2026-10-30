"""Documentos privados de pacientes en Supabase Storage (RNF-06)."""

import re
import uuid

import httpx
from sqlalchemy.orm import Session

from app.adapters.storage import PrivateStorage
from app.core.config import settings
from app.core.constants import DOCUMENT_CONTENT_TYPES, DOCUMENT_MAX_BYTES, DOCUMENT_TYPES
from app.core.database import after_commit, on_rollback
from app.core.deps import CurrentUser
from app.core.errors import (
    ExternalServiceError,
    NotFound,
    PayloadTooLarge,
    UnsupportedMediaType,
    ValidationError,
)
from app.models import PatientDocument
from app.repositories import document_repository
from app.services import audit_service
from app.services.patient_service import get_patient

STORAGE_ERROR = "No se pudo acceder al almacenamiento de documentos. Intenta nuevamente."
DOCUMENT_NOT_FOUND = "Documento no encontrado."


def _safe_file_name(file_name: str) -> str:
    cleaned = re.sub(r"[^\w.\- ]", "_", file_name.rsplit("/", 1)[-1]).strip()
    return cleaned[:120] or "documento"


def _audit(db: Session, current: CurrentUser, severity: str, action: str, detail: str) -> None:
    audit_service.audit(
        db, current, category="PACIENTES", severity=severity, action=action, detail=detail
    )


def list_documents(db: Session, patient_id: str) -> list[PatientDocument]:
    get_patient(db, patient_id)
    return document_repository.list_for_patient(db, patient_id)


def upload_document(
    db: Session,
    storage: PrivateStorage,
    current: CurrentUser,
    *,
    patient_id: str,
    document_type: str,
    file_name: str,
    content_type: str,
    content: bytes,
) -> PatientDocument:
    patient = get_patient(db, patient_id)
    if document_type not in DOCUMENT_TYPES:
        raise ValidationError("Tipo de documento inválido. Usa: " + ", ".join(DOCUMENT_TYPES) + ".")
    if content_type not in DOCUMENT_CONTENT_TYPES:
        raise UnsupportedMediaType("Solo se aceptan archivos PDF, JPG, PNG o WEBP.")
    if not content:
        raise ValidationError("El archivo está vacío.")
    if len(content) > DOCUMENT_MAX_BYTES:
        raise PayloadTooLarge("El archivo supera el máximo de 10 MB.")

    document_id = str(uuid.uuid4())
    storage_path = f"{patient.id}/{document_id}{DOCUMENT_CONTENT_TYPES[content_type]}"
    # Primero la metadata (valida las restricciones de la base) y después el archivo
    document = document_repository.add(
        db,
        PatientDocument(
            id=document_id,
            patient_id=patient.id,
            document_type=document_type,
            file_name=_safe_file_name(file_name),
            storage_path=storage_path,
            content_type=content_type,
            size_bytes=len(content),
            uploaded_by=current.user.id,
        ),
    )
    try:
        storage.upload(storage_path, content, content_type)
    except httpx.HTTPError as exc:
        raise ExternalServiceError(STORAGE_ERROR) from exc
    # Si la transacción no llega a confirmarse, el archivo subido se borra
    on_rollback(db, lambda: storage.delete(storage_path))
    _audit(
        db,
        current,
        "INFO",
        "Carga de documento privado de paciente",
        f"Subió '{document.file_name}' ({document_type}) a la ficha de {patient.name}",
    )
    return document


def signed_url(
    db: Session, storage: PrivateStorage, current: CurrentUser, patient_id: str, document_id: str
) -> tuple[str, int]:
    document = document_repository.get_for_patient(db, patient_id, document_id)
    if document is None:
        raise NotFound(DOCUMENT_NOT_FOUND)
    try:
        url = storage.signed_url(document.storage_path, settings.signed_url_seconds)
    except httpx.HTTPError as exc:
        raise ExternalServiceError(STORAGE_ERROR) from exc
    _audit(
        db,
        current,
        "INFO",
        "Descarga de documento privado de paciente",
        f"Generó enlace temporal de '{document.file_name}' (paciente {patient_id})",
    )
    return url, settings.signed_url_seconds


def delete_document(
    db: Session, storage: PrivateStorage, current: CurrentUser, patient_id: str, document_id: str
) -> None:
    document = document_repository.get_for_patient(db, patient_id, document_id)
    if document is None:
        raise NotFound(DOCUMENT_NOT_FOUND)
    storage_path = document.storage_path
    document_repository.delete(db, document)
    # El archivo se borra solo si se confirma el borrado de la metadata: si la base falla,
    # el documento sigue completo. Si falla Storage después, queda en el log para revisarlo.
    after_commit(db, lambda: storage.delete(storage_path))
    _audit(
        db,
        current,
        "CRITICAL",
        "Eliminación de documento privado de paciente",
        f"Eliminó '{document.file_name}' de la ficha {patient_id}",
    )
