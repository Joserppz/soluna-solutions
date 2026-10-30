from fastapi import APIRouter, Depends, File, Form, UploadFile, status

from app.adapters.storage import PrivateStorage, get_private_storage
from app.core.database import DbSession
from app.core.schemas import MessageResponse
from app.modules.auth.dependencies import CurrentUser, require_roles
from app.modules.documents import service as document_service
from app.modules.documents.models import DOCUMENT_MAX_BYTES, PatientDocument
from app.modules.documents.schemas import PatientDocumentOut, SignedUrlOut
from app.modules.users.models import CLINICAL_ROLES, PATIENT_EDITOR_ROLES

router = APIRouter(prefix="/api/v1/patients/{patient_id}/documents", tags=["Documentos privados"])


def to_document_out(document: PatientDocument) -> PatientDocumentOut:
    return PatientDocumentOut(
        id=document.id,
        patient_id=document.patient_id,
        document_type=document.document_type,
        file_name=document.file_name,
        content_type=document.content_type,
        size_bytes=document.size_bytes,
        uploaded_at=document.uploaded_at.isoformat(),
    )


@router.get("", response_model=list[PatientDocumentOut], response_model_by_alias=True)
def list_documents(
    patient_id: str,
    db: DbSession,
    current: CurrentUser = Depends(require_roles(*CLINICAL_ROLES)),
):
    return [to_document_out(doc) for doc in document_service.list_documents(db, patient_id)]


@router.post(
    "",
    response_model=PatientDocumentOut,
    response_model_by_alias=True,
    status_code=status.HTTP_201_CREATED,
)
def upload_document(
    patient_id: str,
    db: DbSession,
    document_type: str = Form(alias="documentType"),
    file: UploadFile = File(),
    current: CurrentUser = Depends(require_roles(*PATIENT_EDITOR_ROLES)),
    storage: PrivateStorage = Depends(get_private_storage),
):
    content = file.file.read(DOCUMENT_MAX_BYTES + 1)
    document = document_service.upload_document(
        db,
        storage,
        current,
        patient_id=patient_id,
        document_type=document_type,
        file_name=file.filename or "documento",
        content_type=file.content_type or "",
        content=content,
    )
    return to_document_out(document)


@router.get("/{document_id}/url", response_model=SignedUrlOut, response_model_by_alias=True)
def document_url(
    patient_id: str,
    document_id: str,
    db: DbSession,
    current: CurrentUser = Depends(require_roles(*CLINICAL_ROLES)),
    storage: PrivateStorage = Depends(get_private_storage),
):
    url, expires_in = document_service.signed_url(db, storage, current, patient_id, document_id)
    return SignedUrlOut(url=url, expires_in=expires_in)


@router.delete("/{document_id}", response_model=MessageResponse)
def delete_document(
    patient_id: str,
    document_id: str,
    db: DbSession,
    current: CurrentUser = Depends(require_roles("Administrador")),
    storage: PrivateStorage = Depends(get_private_storage),
):
    document_service.delete_document(db, storage, current, patient_id, document_id)
    return MessageResponse(message="Documento eliminado")
