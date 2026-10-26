from datetime import date, datetime

from sqlalchemy import Boolean, Date, DateTime, ForeignKey, String, Text, func
from sqlalchemy.orm import Mapped, mapped_column

from app.core.database import Base


class Patient(Base):
    """Ficha del paciente con anamnesis digital (RF-02) y consentimiento (RNF-06)."""

    __tablename__ = "patients"

    id: Mapped[str] = mapped_column(String, primary_key=True)
    name: Mapped[str] = mapped_column(String)
    ci: Mapped[str] = mapped_column(String, unique=True)
    phone: Mapped[str] = mapped_column(String)
    address: Mapped[str] = mapped_column(String)
    emergency_contact: Mapped[str] = mapped_column(String)
    caregiver_relation: Mapped[str] = mapped_column(String)
    consent: Mapped[bool] = mapped_column(Boolean, default=False)
    consent_date: Mapped[date | None] = mapped_column(Date)
    access_status: Mapped[str] = mapped_column(String, default="Pendiente")
    diagnosis: Mapped[str] = mapped_column(String)
    stage: Mapped[str] = mapped_column(String)
    neurologist_certificate: Mapped[bool] = mapped_column(Boolean, default=False)
    symptom_notes: Mapped[str] = mapped_column(Text, default="")
    physical_evaluation: Mapped[str] = mapped_column(Text, default="")
    speech_evaluation: Mapped[str] = mapped_column(Text, default="")
    psychological_evaluation: Mapped[str] = mapped_column(Text, default="")
    medications: Mapped[str] = mapped_column(Text, default="")
    created_by: Mapped[str | None] = mapped_column(ForeignKey("users.id", ondelete="SET NULL"))
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())

    # Columnas de la anamnesis clínica (ClinicalAnamnesis en el frontend)
    ANAMNESIS_COLUMNS = (
        "diagnosis",
        "stage",
        "neurologist_certificate",
        "symptom_notes",
        "physical_evaluation",
        "speech_evaluation",
        "psychological_evaluation",
        "medications",
    )
