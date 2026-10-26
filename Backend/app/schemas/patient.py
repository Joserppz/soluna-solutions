"""DTOs de pacientes: Patient / ClinicalAnamnesis de Frontend/src/types/aspar.ts (camelCase)."""

from datetime import date

from pydantic import BaseModel, ConfigDict, field_validator
from pydantic.alias_generators import to_camel

from app.models import Patient


class CamelModel(BaseModel):
    model_config = ConfigDict(alias_generator=to_camel, populate_by_name=True)


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


def to_patient_out(patient: Patient) -> PatientOut:
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
        anamnesis=ClinicalAnamnesis(
            **{column: getattr(patient, column) for column in Patient.ANAMNESIS_COLUMNS}
        ),
        created_at=patient.created_at.isoformat(),
        updated_at=patient.updated_at.isoformat(),
    )
