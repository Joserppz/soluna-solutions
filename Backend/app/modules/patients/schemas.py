"""DTOs de afiliados (pacientes), sus contactos y su anamnesis base (camelCase)."""

import uuid
from datetime import date, datetime

from pydantic import Field, field_validator

from app.core.pagination import Page
from app.core.schemas import CamelModel
from app.modules.patients.models import ANAMNESIS_COLUMNS, Patient, PatientContact


class ClinicalAnamnesis(CamelModel):
    diagnosis: str = Field(default="Enfermedad de Parkinson", max_length=200)
    stage: str = Field(default="Estadio I (Leve unilateral)", max_length=80)
    neurologist_certificate: bool = False
    symptom_notes: str = Field(default="", max_length=4000)
    medications: str = Field(default="", max_length=2000)


class ClinicalAnamnesisUpdate(CamelModel):
    diagnosis: str | None = Field(default=None, max_length=200)
    stage: str | None = Field(default=None, max_length=80)
    neurologist_certificate: bool | None = None
    symptom_notes: str | None = Field(default=None, max_length=4000)
    medications: str | None = Field(default=None, max_length=2000)


class ContactIn(CamelModel):
    name: str = Field(max_length=120)
    relation: str = Field(max_length=60)
    phone: str = Field(max_length=12)
    alt_phone: str | None = Field(default=None, max_length=12)
    is_primary: bool = False


class ContactUpdate(CamelModel):
    """PATCH de un familiar o cuidador: solo los campos enviados."""

    name: str | None = Field(default=None, max_length=120)
    relation: str | None = Field(default=None, max_length=60)
    phone: str | None = Field(default=None, max_length=12)
    alt_phone: str | None = Field(default=None, max_length=12)
    is_primary: bool | None = None


class ContactOut(CamelModel):
    id: uuid.UUID
    name: str
    relation: str
    phone: str
    alt_phone: str | None
    is_primary: bool


class PatientIn(CamelModel):
    """Alta de una ficha; las reglas de negocio se validan en el servicio."""

    name: str = Field(max_length=120)
    ci: str = Field(max_length=14)
    birth_date: date | None = None
    phone: str = Field(max_length=12)
    address: str = Field(default="", max_length=200)
    zone: str = Field(default="", max_length=80)
    consent: bool = False
    consent_date: date | None = None
    image_consent: bool = False
    access_status: str = Field(default="Pendiente", max_length=20)
    anamnesis: ClinicalAnamnesis | None = None
    # Toda ficha necesita al menos un familiar o persona cuidadora
    contacts: list[ContactIn] = Field(min_length=1, max_length=5)

    @field_validator("consent_date", "birth_date", mode="before")
    @classmethod
    def empty_date_is_none(cls, value):
        return value or None


class PatientUpdate(CamelModel):
    """PATCH parcial: solo se modifican los campos enviados."""

    name: str | None = Field(default=None, max_length=120)
    ci: str | None = Field(default=None, max_length=14)
    birth_date: date | None = None
    phone: str | None = Field(default=None, max_length=12)
    address: str | None = Field(default=None, max_length=200)
    zone: str | None = Field(default=None, max_length=80)
    consent: bool | None = None
    consent_date: date | None = None
    image_consent: bool | None = None
    access_status: str | None = Field(default=None, max_length=20)
    anamnesis: ClinicalAnamnesisUpdate | None = None

    @field_validator("consent_date", "birth_date", mode="before")
    @classmethod
    def empty_date_is_none(cls, value):
        return value or None


class PatientDeactivate(CamelModel):
    reason: str = Field(min_length=3, max_length=300)


class PatientOut(CamelModel):
    id: uuid.UUID
    name: str
    ci: str
    birth_date: date | None
    phone: str
    address: str
    zone: str
    consent: bool
    consent_date: date | None
    image_consent: bool
    access_status: str
    # Sin acceso clínico (RNF-06) la anamnesis llega vacía y clinicalAccess es false
    anamnesis: ClinicalAnamnesis
    clinical_access: bool
    contacts: list[ContactOut]
    active: bool
    deactivation_reason: str | None
    created_at: datetime
    updated_at: datetime


class PatientSummaryOut(CamelModel):
    """Fila del listado: sin anamnesis (S5). La ficha clínica completa solo se obtiene con
    GET /patients/{id}, que queda en la bitácora."""

    id: uuid.UUID
    name: str
    ci: str
    phone: str
    zone: str
    consent: bool
    image_consent: bool
    access_status: str
    primary_contact: ContactOut | None
    active: bool
    created_at: datetime
    updated_at: datetime


class PatientPage(Page[PatientSummaryOut]):
    """Página del listado de afiliados."""


RESTRICTED_ANAMNESIS = ClinicalAnamnesis(
    diagnosis="",
    stage="",
    neurologist_certificate=False,
    symptom_notes="",
    medications="",
)


def to_contact_out(contact: PatientContact) -> ContactOut:
    return ContactOut(
        id=contact.id,
        name=contact.name,
        relation=contact.relation,
        phone=contact.phone,
        alt_phone=contact.alt_phone,
        is_primary=contact.is_primary,
    )


def to_patient_out(patient: Patient, clinical_access: bool) -> PatientOut:
    return PatientOut(
        id=patient.id,
        name=patient.name,
        ci=patient.ci,
        birth_date=patient.birth_date,
        phone=patient.phone,
        address=patient.address,
        zone=patient.zone,
        consent=patient.consent,
        consent_date=patient.consent_date,
        image_consent=patient.image_consent,
        access_status=patient.access_status,
        anamnesis=(
            ClinicalAnamnesis(**{column: getattr(patient, column) for column in ANAMNESIS_COLUMNS})
            if clinical_access
            else RESTRICTED_ANAMNESIS
        ),
        clinical_access=clinical_access,
        contacts=[to_contact_out(contact) for contact in patient.active_contacts],
        active=patient.active,
        deactivation_reason=patient.deactivation_reason,
        created_at=patient.created_at,
        updated_at=patient.updated_at,
    )


def to_patient_summary(patient: Patient) -> PatientSummaryOut:
    contacts = patient.active_contacts
    primary = next((contact for contact in contacts if contact.is_primary), None)
    primary = primary or (contacts[0] if contacts else None)
    return PatientSummaryOut(
        id=patient.id,
        name=patient.name,
        ci=patient.ci,
        phone=patient.phone,
        zone=patient.zone,
        consent=patient.consent,
        image_consent=patient.image_consent,
        access_status=patient.access_status,
        primary_contact=to_contact_out(primary) if primary else None,
        active=patient.active,
        created_at=patient.created_at,
        updated_at=patient.updated_at,
    )
