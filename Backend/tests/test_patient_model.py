from datetime import UTC, date, datetime

import pytest
from sqlalchemy.exc import IntegrityError

from app.models import Patient, PatientContact
from app.modules.patients import repository as patient_repository
from app.modules.patients.models import ACCESS_STATUSES, PARKINSON_STAGES
from app.modules.patients.schemas import PatientIn, to_patient_out
from tests.conftest import requires_db


def build_patient(**overrides) -> Patient:
    now = datetime(2026, 8, 15, 12, 0, tzinfo=UTC)
    values = {
        "name": "Rosa Mamani",
        "ci": "4455667",
        "phone": "71234567",
        "address": "El Alto",
        "zone": "",
        "consent": True,
        "consent_date": date(2026, 8, 15),
        "image_consent": False,
        "access_status": "Activo",
        "diagnosis": "Enfermedad de Parkinson",
        "stage": PARKINSON_STAGES[1],
        "neurologist_certificate": True,
        "symptom_notes": "Temblor",
        "medications": "Levodopa",
        "created_at": now,
        "updated_at": now,
        "contacts": [
            PatientContact(name="Luis Mamani", relation="Hijo", phone="70011223", is_primary=True)
        ],
    }
    return Patient(**(values | overrides))


def test_salida_en_camel_case():
    patient = build_patient(id="00000000-0000-0000-0000-000000000001")
    patient.contacts[0].id = "00000000-0000-0000-0000-000000000002"
    patient.contacts[0].active = True

    data = to_patient_out(patient, clinical_access=True).model_dump(by_alias=True)

    assert {"consentDate", "accessStatus", "imageConsent", "clinicalAccess", "contacts"} <= set(
        data
    )
    assert data["anamnesis"]["neurologistCertificate"] is True
    assert data["contacts"][0]["isPrimary"] is True


def test_sin_acceso_clinico_la_anamnesis_sale_vacia():
    patient = build_patient(id="00000000-0000-0000-0000-000000000001")

    data = to_patient_out(patient, clinical_access=False)

    assert data.anamnesis.symptom_notes == ""
    assert data.anamnesis.medications == ""
    assert data.clinical_access is False


def test_entrada_acepta_camel_case_y_fechas_vacias():
    data = PatientIn.model_validate(
        {
            "name": "Rosa",
            "ci": "4455667",
            "phone": "71234567",
            "consentDate": "",
            "birthDate": "",
            "contacts": [{"name": "Luis", "relation": "Hijo", "phone": "70011223"}],
            "anamnesis": {"neurologistCertificate": True},
        }
    )

    assert data.consent_date is None
    assert data.birth_date is None
    assert data.anamnesis.neurologist_certificate is True


def test_constantes_del_dominio():
    assert ACCESS_STATUSES == ("Activo", "Pendiente", "Revocado")
    assert len(PARKINSON_STAGES) == 6


@requires_db
class TestRestriccionesDeLaTabla:
    def test_guarda_y_lee_un_paciente_con_uuid_del_servidor(self, db_session):
        patient = patient_repository.add(db_session, build_patient())

        assert patient.id is not None
        assert patient_repository.get_by_ci(db_session, "4455667").name == "Rosa Mamani"

    def test_ci_duplicada_es_rechazada(self, db_session):
        patient_repository.add(db_session, build_patient())

        with pytest.raises(IntegrityError):
            patient_repository.add(db_session, build_patient())

    def test_acceso_activo_sin_consentimiento_es_rechazado_por_la_base(self, db_session):
        with pytest.raises(IntegrityError, match="patients_activo_requiere_consentimiento"):
            patient_repository.add(db_session, build_patient(consent=False))

    def test_estadio_desconocido_es_rechazado(self, db_session):
        with pytest.raises(IntegrityError):
            patient_repository.add(db_session, build_patient(stage="Estadio VI"))

    def test_textos_mas_largos_que_el_limite_son_rechazados(self, db_session):
        with pytest.raises(IntegrityError):
            patient_repository.add(db_session, build_patient(symptom_notes="x" * 4001))

    def test_baja_requiere_motivo(self, db_session):
        with pytest.raises(IntegrityError, match="patients_baja_con_motivo"):
            patient_repository.add(db_session, build_patient(deleted_at=datetime.now(UTC)))

    def test_un_solo_contacto_principal_activo(self, db_session):
        patient = build_patient()
        patient.contacts.append(
            PatientContact(name="Ana Mamani", relation="Hija", phone="70011224", is_primary=True)
        )

        with pytest.raises(IntegrityError, match="patient_contacts_un_principal"):
            patient_repository.add(db_session, patient)

    def test_busqueda_por_nombre_y_ci(self, db_session):
        assert [p.ci for p in patient_repository.list_patients(db_session, search="elena")] == [
            "1234567"
        ]
        assert len(patient_repository.list_patients(db_session, access_status="Pendiente")) == 1
