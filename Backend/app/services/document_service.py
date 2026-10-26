"""Documentos privados de pacientes en Supabase Storage (RNF-06)."""

import re
import uuid

import httpx
from fastapi import HTTPException, status
from sqlalchemy.orm import Session

from app.adapters.storage import PrivateStorage
from app.core.config import SIGNED_URL_SECONDS
from app.core.constants import DOCUMENT_CONTENT_TYPES, DOCUMENT_MAX_BYTES, DOCUMENT_TYPES
from app.core.deps import CurrentUser
from app.models import PatientDocument
from app.repositories import document_repository
from app.services import audit_service
from app.services.patient_service import get_patient

STORAGE_ERROR = "No se pudo acceder al almacenamiento de documentos. Intenta nuevamente."


def _safe_file_name(file_name: str) -> str:
    cleaned = re.sub(r"[^\w.\- ]", "_", file_name.rsplit("/", 1)[-1]).strip()
    return cleaned[:120] or "documento"


def _audit(db: Session, current: CurrentUser, severity: str, action: str, detail: str) -> None:
    audit_service.record(
        db,
        actor=current.user.email,
        actor_role=current.user.role,
        category="PACIENTES",
        severity=severity,
        action=action,
        detail=detail,
        ip_address=current.ip,
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
        raise HTTPException(
            status.HTTP_422_UNPROCESSABLE_CONTENT,
            "Tipo de documento inválido. Usa: " + ", ".join(DOCUMENT_TYPES) + ".",
        )
    if content_type not in DOCUMENT_CONTENT_TYPES:
        raise HTTPException(
            status.HTTP_415_UNSUPPORTED_MEDIA_TYPE, "Solo se aceptan archivos PDF, JPG, PNG o WEBP."
        )
    if not content:
        raise HTTPException(status.HTTP_422_UNPROCESSABLE_CONTENT, "El archivo está vacío.")
    if len(content) > DOCUMENT_MAX_BYTES:
        raise HTTPException(
            status.HTTP_413_CONTENT_TOO_LARGE, "El archivo supera el máximo de 10 MB."
        )

    document_id = str(uuid.uuid4())
    storage_path = f"{patient.id}/{document_id}{DOCUMENT_CONTENT_TYPES[content_type]}"
    try:
        storage.upload(storage_path, content, content_type)
    except httpx.HTTPError as exc:
        raise HTTPException(status.HTTP_502_BAD_GATEWAY, STORAGE_ERROR) from exc

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
    _audit(
        db,
        current,
        "INFO",
        "Carga de documento privado de paciente",
        f"Subió '{document.file_name}' ({document_type}) a la ficha de {patient.name}",
    )
    db.commit()
    return document


def signed_url(
    db: Session, storage: PrivateStorage, current: CurrentUser, patient_id: str, document_id: str
) -> tuple[str, int]:
    document = document_repository.get_for_patient(db, patient_id, document_id)
    if document is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Documento no encontrado.")
    try:
        url = storage.signed_url(document.storage_path, SIGNED_URL_SECONDS)
    except httpx.HTTPError as exc:
        raise HTTPException(status.HTTP_502_BAD_GATEWAY, STORAGE_ERROR) from exc
    _audit(
        db,
        current,
        "INFO",
        "Descarga de documento privado de paciente",
        f"Generó enlace temporal de '{document.file_name}' (paciente {patient_id})",
    )
    db.commit()
    return url, SIGNED_URL_SECONDS


def delete_document(
    db: Session, storage: PrivateStorage, current: CurrentUser, patient_id: str, document_id: str
) -> None:
    document = document_repository.get_for_patient(db, patient_id, document_id)
    if document is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Documento no encontrado.")
    try:
        storage.delete(document.storage_path)
    except httpx.HTTPError as exc:
        raise HTTPException(status.HTTP_502_BAD_GATEWAY, STORAGE_ERROR) from exc
    document_repository.delete(db, document)
    _audit(
        db,
        current,
        "CRITICAL",
        "Eliminación de documento privado de paciente",
        f"Eliminó '{document.file_name}' de la ficha {patient_id}",
    )
    db.commit()
