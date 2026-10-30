from datetime import UTC, date, datetime

import pytest
from sqlalchemy.exc import IntegrityError

from app.models import Patient
from app.modules.patients import repository as patient_repository
from app.modules.patients.models import ACCESS_STATUSES, PARKINSON_STAGES
from app.modules.patients.schemas import PatientIn, to_patient_out
from tests.conftest import requires_db


def build_patient(**overrides) -> Patient:
    now = datetime(2026, 8, 15, 12, 0, tzinfo=UTC)
    values = {
        "id": "p-test",
        "name": "Rosa Mamani",
        "ci": "4455667",
        "phone": "71234567",
        "address": "El Alto",
        "emergency_contact": "Luis Mamani (70011223)",
        "caregiver_relation": "Hijo",
        "consent": True,
        "consent_date": date(2026, 8, 15),
        "access_status": "Activo",
        "diagnosis": "Enfermedad de Parkinson",
        "stage": PARKINSON_STAGES[1],
        "neurologist_certificate": True,
        "symptom_notes": "Temblor",
        "physical_evaluation": "",
        "speech_evaluation": "",
        "psychological_evaluation": "",
        "medications": "Levodopa",
        "created_at": now,
        "updated_at": now,
    }
    return Patient(**(values | overrides))


def test_salida_usa_camel_case_igual_que_el_frontend():
    out = to_patient_out(build_patient(), clinical_access=True).model_dump(by_alias=True)

    assert set(out) == {
        "id",
        "name",
        "ci",
        "phone",
        "address",
        "emergencyContact",
        "caregiverRelation",
        "consent",
        "consentDate",
        "accessStatus",
        "anamnesis",
        "clinicalAccess",
        "createdAt",
        "updatedAt",
    }
    assert set(out["anamnesis"]) == {
        "diagnosis",
        "stage",
        "neurologistCertificate",
        "symptomNotes",
        "physicalEvaluation",
        "speechEvaluation",
        "psychologicalEvaluation",
        "medications",
    }
    assert out["consentDate"] == "2026-08-15"


def test_sin_consentimiento_la_fecha_sale_vacia():
    out = to_patient_out(
        build_patient(consent=False, consent_date=None, access_status="Pendiente"),
        clinical_access=False,
    )

    assert out.consent_date == ""


def test_sin_acceso_clinico_la_anamnesis_sale_vacia():
    out = to_patient_out(build_patient(), clinical_access=False)

    assert out.clinical_access is False
    assert out.anamnesis.medications == ""
    assert out.anamnesis.diagnosis == ""


def test_entrada_acepta_camel_case_y_fecha_vacia():
    data = PatientIn.model_validate(
        {
            "name": "Rosa Mamani",
            "ci": "4455667",
            "phone": "71234567",
            "emergencyContact": "Luis",
            "consentDate": "",
            "anamnesis": {"neurologistCertificate": True},
        }
    )

    assert data.emergency_contact == "Luis"
    assert data.consent_date is None
    assert data.anamnesis.neurologist_certificate is True


def test_constantes_coinciden_con_el_frontend():
    assert ACCESS_STATUSES == ("Activo", "Pendiente", "Revocado")
    assert len(PARKINSON_STAGES) == 6


@requires_db
class TestRestriccionesDeLaTabla:
    def test_guarda_y_lee_un_paciente(self, db_session):
        patient_repository.add(db_session, build_patient())

        assert patient_repository.get_by_ci(db_session, "4455667").name == "Rosa Mamani"

    def test_ci_duplicada_es_rechazada(self, db_session):
        patient_repository.add(db_session, build_patient())

        with pytest.raises(IntegrityError):
            patient_repository.add(db_session, build_patient(id="p-otro"))

    def test_acceso_activo_sin_consentimiento_es_rechazado_por_la_base(self, db_session):
        with pytest.raises(IntegrityError, match="patients_activo_requiere_consentimiento"):
            patient_repository.add(db_session, build_patient(consent=False))

    def test_estadio_desconocido_es_rechazado(self, db_session):
        with pytest.raises(IntegrityError):
            patient_repository.add(db_session, build_patient(stage="Estadio VI"))

    def test_busqueda_por_nombre_y_ci(self, db_session):
        assert [p.ci for p in patient_repository.list_patients(db_session, search="elena")] == [
            "1234567"
        ]
        assert len(patient_repository.list_patients(db_session, access_status="Pendiente")) == 1
