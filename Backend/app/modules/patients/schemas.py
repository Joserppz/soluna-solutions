"""DTOs de pacientes: Patient / ClinicalAnamnesis de Frontend/src/types/aspar.ts (camelCase)."""

from datetime import date

from pydantic import field_validator

from app.core.schemas import CamelModel
from app.modules.patients.models import Patient


class ClinicalAnamnesis(CamelModel):
    diagnosis: str = "Enfermedad de Parkinson"
    stage: str = "Estadio I (Leve unilateral)"
    neurologist_certificate: bool = False
    symptom_notes: str = ""
    physical_evaluation: str = ""
    speech_evaluation: str = ""
    psychological_evaluation: str = ""
    medications: str = ""


class PatientOut(CamelModel):
    id: str
    name: str
    ci: str
    phone: str
    address: str
    emergency_contact: str
    caregiver_relation: str
    consent: bool
    consent_date: str
    access_status: str
    anamnesis: ClinicalAnamnesis
    clinical_access: bool
    created_at: str
    updated_at: str


class PatientIn(CamelModel):
    """Campos comunes de entrada; las reglas de negocio se validan en el servicio."""

    name: str
    ci: str
    phone: str
    address: str = "La Paz, Bolivia"
    emergency_contact: str
    caregiver_relation: str = "Familiar / Cuidador"
    consent: bool = False
    consent_date: date | None = None
    access_status: str = "Pendiente"
    anamnesis: ClinicalAnamnesis | None = None

    @field_validator("consent_date", mode="before")
    @classmethod
    def empty_date_is_none(cls, value):
        # El frontend envía consentDate: "" cuando no hay consentimiento
        return value or None


class ClinicalAnamnesisUpdate(CamelModel):
    diagnosis: str | None = None
    stage: str | None = None
    neurologist_certificate: bool | None = None
    symptom_notes: str | None = None
    physical_evaluation: str | None = None
    speech_evaluation: str | None = None
    psychological_evaluation: str | None = None
    medications: str | None = None


class PatientUpdate(CamelModel):
    """PATCH parcial: solo se modifican los campos enviados."""

    name: str | None = None
    ci: str | None = None
    phone: str | None = None
    address: str | None = None
    emergency_contact: str | None = None
    caregiver_relation: str | None = None
    consent: bool | None = None
    consent_date: date | None = None
    access_status: str | None = None
    anamnesis: ClinicalAnamnesisUpdate | None = None

    @field_validator("consent_date", mode="before")
    @classmethod
    def empty_date_is_none(cls, value):
        return value or None


RESTRICTED_ANAMNESIS = ClinicalAnamnesis(
    diagnosis="",
    stage="",
    neurologist_certificate=False,
    symptom_notes="",
    physical_evaluation="",
    speech_evaluation="",
    psychological_evaluation="",
    medications="",
)


def to_patient_out(patient: Patient, clinical_access: bool) -> PatientOut:
    """Convierte a DTO; sin acceso clínico (RNF-06) la anamnesis sale vacía."""
    return PatientOut(
        id=patient.id,
        name=patient.name,
        ci=patient.ci,
        phone=patient.phone,
        address=patient.address,
        emergency_contact=patient.emergency_contact,
        caregiver_relation=patient.caregiver_relation,
        consent=patient.consent,
        consent_date=patient.consent_date.isoformat() if patient.consent_date else "",
        access_status=patient.access_status,
        anamnesis=(
            ClinicalAnamnesis(
                **{column: getattr(patient, column) for column in Patient.ANAMNESIS_COLUMNS}
            )
            if clinical_access
            else RESTRICTED_ANAMNESIS
        ),
        clinical_access=clinical_access,
        created_at=patient.created_at.isoformat(),
        updated_at=patient.updated_at.isoformat(),
    )
