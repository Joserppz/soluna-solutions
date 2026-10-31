import uuid
from datetime import datetime

from sqlalchemy import Boolean, DateTime, ForeignKey, String, Uuid, func
from sqlalchemy.orm import Mapped, mapped_column

from app.core.database import Base

# Tipos, orígenes y estados de una solicitud (RF-16, diseño pág. 17)
KIND_LABELS = {
    "orientacion": "Orientación para participar",
    "voluntariado": "Quiere ser voluntario/a",
    "especie": "Ofrece una donación en especie",
    "participar": "Quiere participar en una actividad",
    "asistencia": "Llegó a una actividad por primera vez",
    "otro": "Otro motivo",
}
KINDS = tuple(KIND_LABELS)
# Lo que se puede pedir desde el sitio (la asistencia la anota el voluntariado)
PUBLIC_KINDS = ("orientacion", "voluntariado", "especie", "participar", "otro")
SOURCES = ("sitio", "asistencia", "sede")
STATUS_LABELS = {
    "recibida": "Nueva",
    "por_contactar": "Por contactar",
    "contactada": "Contactada",
    "inscrita": "Inscrita",
    "cerrada": "Cerrada",
}
STATUSES = tuple(STATUS_LABELS)
# Cambios de estado permitidos con PATCH; «inscrita» solo se alcanza al inscribir
TRANSITIONS = {
    "recibida": {"por_contactar", "contactada", "cerrada"},
    "por_contactar": {"contactada", "cerrada"},
    "contactada": {"por_contactar", "cerrada"},
    "inscrita": set(),
    "cerrada": {"recibida"},
}
OPEN_STATUSES = ("recibida", "por_contactar", "contactada", "inscrita")


class Inquiry(Base):
    __tablename__ = "inquiries"

    id: Mapped[uuid.UUID] = mapped_column(
        Uuid, primary_key=True, server_default=func.gen_random_uuid()
    )
    kind: Mapped[str] = mapped_column(String)
    source: Mapped[str] = mapped_column(String, default="sitio")
    name: Mapped[str] = mapped_column(String)
    phone: Mapped[str] = mapped_column(String)
    on_behalf_of: Mapped[str] = mapped_column(String, default="")
    zone: Mapped[str] = mapped_column(String, default="")
    preferred_call_time: Mapped[str] = mapped_column(String, default="")
    message: Mapped[str] = mapped_column(String, default="")
    schedule_id: Mapped[uuid.UUID | None] = mapped_column(
        ForeignKey("schedules.id", ondelete="SET NULL")
    )
    status: Mapped[str] = mapped_column(String, default="recibida")
    assigned_to: Mapped[uuid.UUID | None] = mapped_column(
        ForeignKey("users.id", ondelete="SET NULL")
    )
    patient_id: Mapped[uuid.UUID | None] = mapped_column(
        ForeignKey("patients.id", ondelete="SET NULL")
    )
    contact_consent: Mapped[bool] = mapped_column(Boolean, default=False)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())


class InquiryNote(Base):
    """Nota de seguimiento («Notas de la llamada»)."""

    __tablename__ = "inquiry_notes"

    id: Mapped[uuid.UUID] = mapped_column(
        Uuid, primary_key=True, server_default=func.gen_random_uuid()
    )
    inquiry_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("inquiries.id", ondelete="CASCADE"))
    author_id: Mapped[uuid.UUID | None] = mapped_column(ForeignKey("users.id", ondelete="SET NULL"))
    author_name: Mapped[str] = mapped_column(String)
    note: Mapped[str] = mapped_column(String)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
