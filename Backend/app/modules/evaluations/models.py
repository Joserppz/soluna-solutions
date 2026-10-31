import uuid
from datetime import date, datetime

from sqlalchemy import Date, DateTime, ForeignKey, String, Text, Uuid, func
from sqlalchemy.orm import Mapped, mapped_column

from app.core.database import Base

# Áreas de las evaluaciones de seguimiento (diseño pág. 9) y su nombre visible
AREAS = ("fisica", "fonoaudiologica", "psicologica")
AREA_LABELS = {
    "fisica": "Física",
    "fonoaudiologica": "Fonoaudiológica",
    "psicologica": "Psicológica",
}


class PatientEvaluation(Base):
    """Evaluación de seguimiento de un afiliado: dato clínico (RNF-06)."""

    __tablename__ = "patient_evaluations"

    id: Mapped[uuid.UUID] = mapped_column(
        Uuid, primary_key=True, server_default=func.gen_random_uuid()
    )
    patient_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("patients.id", ondelete="CASCADE"))
    area: Mapped[str] = mapped_column(String)
    evaluated_on: Mapped[date] = mapped_column(Date)
    # Profesional que revisó: una cuenta del equipo o un nombre (p. ej. un neurólogo externo)
    professional_id: Mapped[uuid.UUID | None] = mapped_column(
        ForeignKey("users.id", ondelete="SET NULL")
    )
    professional_name: Mapped[str] = mapped_column(String)
    notes: Mapped[str] = mapped_column(Text)
    created_by: Mapped[uuid.UUID | None] = mapped_column(
        ForeignKey("users.id", ondelete="SET NULL")
    )
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
