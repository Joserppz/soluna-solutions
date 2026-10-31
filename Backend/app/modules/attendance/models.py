import uuid
from datetime import datetime

from sqlalchemy import DateTime, ForeignKey, String, Uuid, func
from sqlalchemy.orm import Mapped, mapped_column

from app.core.database import Base

STATUSES = ("vino", "no_vino", "sin_marcar")
MARKED = ("vino", "no_vino")


class Attendance(Base):
    """Asistencia de un afiliado a una actividad (RF-12, diseño págs. 3 y 10)."""

    __tablename__ = "attendance"

    id: Mapped[uuid.UUID] = mapped_column(
        Uuid, primary_key=True, server_default=func.gen_random_uuid()
    )
    schedule_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("schedules.id", ondelete="RESTRICT"))
    patient_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("patients.id", ondelete="RESTRICT"))
    status: Mapped[str] = mapped_column(String, default="sin_marcar")
    # Nota rápida («Viene con su hija», «Usa bastón»): no es un dato clínico
    note: Mapped[str] = mapped_column(String, default="")
    marked_by: Mapped[uuid.UUID | None] = mapped_column(ForeignKey("users.id", ondelete="SET NULL"))
    marked_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
