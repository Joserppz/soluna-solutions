"""DTOs de los documentos privados de los afiliados."""

import uuid
from datetime import datetime

from app.core.schemas import CamelModel


class PatientDocumentOut(CamelModel):
    id: uuid.UUID
    patient_id: uuid.UUID
    document_type: str
    file_name: str
    content_type: str
    size_bytes: int
    uploaded_at: datetime


class SignedUrlOut(CamelModel):
    url: str
    expires_in: int
