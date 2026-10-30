import uuid
from datetime import date, datetime

from sqlalchemy import Boolean, Date, DateTime, ForeignKey, String, Text, Uuid, func
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.core.database import Base

ACCESS_STATUSES = ("Activo", "Pendiente", "Revocado")

PARKINSON_STAGES = (
    "Estadio I (Leve unilateral)",
    "Estadio II (Bilateral sin alteración del equilibrio)",
    "Estadio III (Moderado con inestabilidad postural)",
    "Estadio IV (Incapacidad grave pero camina con ayuda)",
    "Estadio V (Dependencia completa)",
    "Otro trastorno del movimiento",
)

# Anamnesis base de la ficha; las evaluaciones de seguimiento van en patient_evaluations
ANAMNESIS_COLUMNS = (
    "diagnosis",
    "stage",
    "neurologist_certificate",
    "symptom_notes",
    "medications",
)
# Datos que solo registra el personal clínico
CLINICAL_ONLY_COLUMNS = ("symptom_notes", "medications")


class PatientContact(Base):
    """Familiar o persona cuidadora (toda ficha tiene al menos uno activo)."""

    __tablename__ = "patient_contacts"

    id: Mapped[uuid.UUID] = mapped_column(
        Uuid, primary_key=True, server_default=func.gen_random_uuid()
    )
    patient_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("patients.id", ondelete="CASCADE"))
    name: Mapped[str] = mapped_column(String)
    relation: Mapped[str] = mapped_column(String)
    phone: Mapped[str] = mapped_column(String)
    alt_phone: Mapped[str | None] = mapped_column(String)
    is_primary: Mapped[bool] = mapped_column(Boolean, default=False)
    active: Mapped[bool] = mapped_column(Boolean, default=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())


class Patient(Base):
    """Ficha del afiliado con anamnesis base (RF-02) y consentimiento (RNF-06)."""

    __tablename__ = "patients"

    id: Mapped[uuid.UUID] = mapped_column(
        Uuid, primary_key=True, server_default=func.gen_random_uuid()
    )
    name: Mapped[str] = mapped_column(String)
    ci: Mapped[str] = mapped_column(String)
    birth_date: Mapped[date | None] = mapped_column(Date)
    phone: Mapped[str] = mapped_column(String)
    address: Mapped[str] = mapped_column(String, default="")
    zone: Mapped[str] = mapped_column(String, default="")
    consent: Mapped[bool] = mapped_column(Boolean, default=False)
    consent_date: Mapped[date | None] = mapped_column(Date)
    image_consent: Mapped[bool] = mapped_column(Boolean, default=False)
    access_status: Mapped[str] = mapped_column(String, default="Pendiente")
    diagnosis: Mapped[str] = mapped_column(String, default="")
    stage: Mapped[str] = mapped_column(String, default=PARKINSON_STAGES[0])
    neurologist_certificate: Mapped[bool] = mapped_column(Boolean, default=False)
    symptom_notes: Mapped[str] = mapped_column(Text, default="")
    medications: Mapped[str] = mapped_column(Text, default="")
    deleted_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    deactivation_reason: Mapped[str | None] = mapped_column(String)
    deactivated_by: Mapped[uuid.UUID | None] = mapped_column(
        ForeignKey("users.id", ondelete="SET NULL")
    )
    created_by: Mapped[uuid.UUID | None] = mapped_column(
        ForeignKey("users.id", ondelete="SET NULL")
    )
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())

    contacts: Mapped[list[PatientContact]] = relationship(
        lazy="selectin",
        order_by=(PatientContact.is_primary.desc(), PatientContact.created_at),
        cascade="all, delete-orphan",
    )

    @property
    def active(self) -> bool:
        return self.deleted_at is None

    @property
    def active_contacts(self) -> list[PatientContact]:
        return [contact for contact in self.contacts if contact.active]
