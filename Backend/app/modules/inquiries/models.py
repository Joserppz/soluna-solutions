import uuid
from datetime import datetime

from sqlalchemy import Boolean, DateTime, ForeignKey, String, Uuid, func
from sqlalchemy.orm import Mapped, mapped_column

from app.core.database import Base

# Tipos, orígenes y estados de una solicitud (RF-16). Sus endpoints llegan con el
# módulo de Solicitudes; por ahora las crean la agenda pública y la asistencia.
KINDS = ("orientacion", "voluntariado", "especie", "participar", "asistencia", "otro")
SOURCES = ("sitio", "asistencia", "sede")
STATUSES = ("recibida", "por_contactar", "contactada", "inscrita", "cerrada")
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
