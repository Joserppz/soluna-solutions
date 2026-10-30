"""DTOs de los documentos privados de pacientes."""

from app.core.schemas import CamelModel


class PatientDocumentOut(CamelModel):
    id: str
    patient_id: str
    document_type: str
    file_name: str
    content_type: str
    size_bytes: int
    uploaded_at: str


class SignedUrlOut(CamelModel):
    url: str
    expires_in: int
