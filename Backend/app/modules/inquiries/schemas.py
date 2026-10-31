"""DTOs de las solicitudes (camelCase). Sin diagnósticos ni documentos médicos."""

import datetime as dt
import uuid
from typing import Literal

from pydantic import Field

from app.core.pagination import Page
from app.core.schemas import CamelModel
from app.modules.inquiries.models import KINDS, PUBLIC_KINDS, STATUSES
from app.modules.patients.schemas import ContactIn

InquiryKind = Literal[KINDS]
PublicInquiryKind = Literal[PUBLIC_KINDS]
InquiryStatus = Literal[STATUSES]


class PublicInquiryIn(CamelModel):
    """«No tienes que saber por dónde empezar» y «Quiero participar» (diseño págs. 2 y 17)."""

    kind: PublicInquiryKind
    name: str = Field(max_length=120)
    phone: str = Field(max_length=12)
    # Si escribe por otra persona («por su esposo, Julio»)
    on_behalf_of: str = Field(default="", max_length=120)
    zone: str = Field(default="", max_length=80)
    preferred_call_time: str = Field(default="", max_length=60)
    message: str = Field(default="", max_length=1000)
    # Obligatoria para «participar»
    schedule_id: uuid.UUID | None = None
    # «Acepto que el equipo me llame»: sin esto no se registra
    contact_consent: bool
    turnstile_token: str = Field(max_length=2048)


class InquiryOut(CamelModel):
    id: uuid.UUID
    kind: InquiryKind
    kind_label: str
    source: Literal["sitio", "asistencia", "sede"]
    name: str
    phone: str
    on_behalf_of: str
    zone: str
    preferred_call_time: str
    message: str
    schedule_id: uuid.UUID | None
    schedule_title: str | None
    status: InquiryStatus
    status_label: str
    assigned_to: uuid.UUID | None
    assigned_to_name: str | None
    patient_id: uuid.UUID | None
    contact_consent: bool
    created_at: dt.datetime
    updated_at: dt.datetime


class InquiryPage(Page[InquiryOut]):
    """Página de la bandeja de solicitudes."""


class NoteOut(CamelModel):
    id: uuid.UUID
    author_name: str
    note: str
    created_at: dt.datetime


class InquiryDetailOut(InquiryOut):
    notes: list[NoteOut]


class InquiryUpdate(CamelModel):
    status: InquiryStatus | None = None
    # Persona del equipo que la atiende (null la desasigna)
    assigned_to: uuid.UUID | None = None


class NoteIn(CamelModel):
    note: str = Field(min_length=1, max_length=2000)
    # «Guardar y marcar como contactada»
    mark_contacted: bool = False


class InquirySummary(CamelModel):
    """Contadores de las pestañas de la bandeja."""

    recibida: int
    por_contactar: int
    contactada: int
    inscrita: int
    cerrada: int
    total: int


class PatientDraftOut(CamelModel):
    """Datos para precargar la ficha nueva al «Inscribir como afiliado»."""

    name: str
    phone: str
    zone: str
    contacts: list[ContactIn]


class InquiryConvert(CamelModel):
    """Ficha nueva desde la solicitud; lo que no se envía se toma de la solicitud."""

    ci: str = Field(max_length=14)
    name: str | None = Field(default=None, max_length=120)
    phone: str | None = Field(default=None, max_length=12)
    birth_date: dt.date | None = None
    address: str = Field(default="", max_length=200)
    zone: str | None = Field(default=None, max_length=80)
    # Vacío: si escribió por otra persona, quien escribió queda como contacto
    contacts: list[ContactIn] = Field(default_factory=list, max_length=5)
