"""Ficha del afiliado (diseño pág. 9): familiares o cuidadores y evaluaciones de seguimiento."""

from datetime import timedelta

import pytest
from sqlalchemy import select

from app.core import clock
from app.models import AuditLog, PatientContact
from tests.conftest import requires_db

pytestmark = requires_db

CONTACT = {"name": "Rosa Gutiérrez", "relation": "Hija", "phone": "76559012"}


def contacts_url(patient_id, contact_id=None):
    base = f"/api/v1/patients/{patient_id}/contacts"
    return f"{base}/{contact_id}" if contact_id else base


def evaluations_url(patient_id, evaluation_id=None):
    base = f"/api/v1/patients/{patient_id}/evaluations"
    return f"{base}/{evaluation_id}" if evaluation_id else base


def active_contacts(client, headers, patient_id):
    response = client.get(contacts_url(patient_id), headers=headers)
    assert response.status_code == 200, response.text
    return response.json()


class TestContactos:
    def test_agregar_un_familiar_y_hacerlo_principal(self, client, auth_headers, patient_ids):
        headers = auth_headers("reception")
        patient = patient_ids["consent"]

        added = client.post(contacts_url(patient), json=CONTACT, headers=headers)
        assert added.status_code == 201, added.text
        assert added.json()["isPrimary"] is False

        promoted = client.patch(
            contacts_url(patient, added.json()["id"]), json={"isPrimary": True}, headers=headers
        )
        assert promoted.status_code == 200
        contacts = active_contacts(client, headers, patient)
        assert [c["name"] for c in contacts if c["isPrimary"]] == ["Rosa Gutiérrez"]
        assert len(contacts) == 2

    def test_editar_y_validar_un_contacto(self, client, auth_headers, patient_ids):
        headers = auth_headers("reception")
        patient = patient_ids["consent"]
        contact_id = active_contacts(client, headers, patient)[0]["id"]

        edited = client.patch(
            contacts_url(patient, contact_id),
            json={"phone": "70011223", "altPhone": "22412345"},
            headers=headers,
        )
        bad_phone = client.patch(
            contacts_url(patient, contact_id), json={"phone": "12-34"}, headers=headers
        )
        empty_name = client.patch(
            contacts_url(patient, contact_id), json={"name": ""}, headers=headers
        )

        assert edited.json()["phone"] == "70011223"
        assert edited.json()["altPhone"] == "22412345"
        assert edited.json()["name"] == "Carlos Rojas"
        assert bad_phone.status_code == 422
        assert empty_name.status_code == 422

    def test_no_se_puede_quitar_el_ultimo_contacto(self, client, auth_headers, patient_ids):
        headers = auth_headers("reception")
        patient = patient_ids["consent"]
        only = active_contacts(client, headers, patient)[0]["id"]

        response = client.delete(contacts_url(patient, only), headers=headers)

        assert response.status_code == 409
        assert "al menos un contacto de apoyo" in response.json()["detail"]

    def test_quitar_el_principal_promueve_a_otro_y_no_borra_nada(
        self, client, auth_headers, patient_ids, db_session
    ):
        headers = auth_headers("reception")
        patient = patient_ids["consent"]
        primary = active_contacts(client, headers, patient)[0]["id"]
        client.post(contacts_url(patient), json=CONTACT, headers=headers)

        response = client.delete(contacts_url(patient, primary), headers=headers)

        assert response.status_code == 200
        contacts = active_contacts(client, headers, patient)
        assert [(c["name"], c["isPrimary"]) for c in contacts] == [("Rosa Gutiérrez", True)]
        kept = db_session.get(PatientContact, primary)
        assert kept is not None and kept.active is False
        assert client.delete(contacts_url(patient, primary), headers=headers).status_code == 404

    def test_el_principal_no_se_desmarca_sin_elegir_otro(self, client, auth_headers, patient_ids):
        headers = auth_headers("reception")
        patient = patient_ids["consent"]
        primary = active_contacts(client, headers, patient)[0]["id"]

        response = client.patch(
            contacts_url(patient, primary), json={"isPrimary": False}, headers=headers
        )

        assert response.status_code == 409

    def test_hasta_cinco_contactos_activos(self, client, auth_headers, patient_ids):
        headers = auth_headers("reception")
        patient = patient_ids["no_consent"]
        for i in range(4):
            assert (
                client.post(
                    contacts_url(patient), json=CONTACT | {"phone": f"7000000{i}"}, headers=headers
                ).status_code
                == 201
            )

        sixth = client.post(contacts_url(patient), json=CONTACT, headers=headers)

        assert sixth.status_code == 409
        assert "hasta 5" in sixth.json()["detail"]

    def test_permisos_y_bitacora(self, client, auth_headers, patient_ids, db_session):
        patient = patient_ids["consent"]

        assert (
            client.get(contacts_url(patient), headers=auth_headers("volunteer")).status_code == 200
        )
        denied = client.post(contacts_url(patient), json=CONTACT, headers=auth_headers("volunteer"))
        assert denied.status_code == 403
        client.post(contacts_url(patient), json=CONTACT, headers=auth_headers("reception"))
        assert db_session.scalar(
            select(AuditLog).where(AuditLog.action == "Registro de familiar o cuidador")
        )


class TestEvaluaciones:
    def test_listar_evaluaciones_de_la_mas_reciente_y_queda_en_bitacora(
        self, client, auth_headers, patient_ids, db_session
    ):
        response = client.get(
            evaluations_url(patient_ids["consent"]), headers=auth_headers("professional")
        )

        assert response.status_code == 200, response.text
        body = response.json()
        assert [e["areaLabel"] for e in body] == ["Física", "Fonoaudiológica", "Psicológica"]
        assert body[0]["professionalName"] == "Lic. Ana Flores (demo)"
        assert db_session.scalar(
            select(AuditLog).where(AuditLog.action == "Consulta de evaluaciones")
        )
        only_physical = client.get(
            evaluations_url(patient_ids["consent"]),
            params={"area": "fisica"},
            headers=auth_headers("professional"),
        )
        assert len(only_physical.json()) == 1

    def test_registrar_una_evaluacion(self, client, auth_headers, patient_ids):
        today = clock.today().isoformat()
        response = client.post(
            evaluations_url(patient_ids["consent"]),
            json={"area": "psicologica", "evaluatedOn": today, "notes": "Buen ánimo en grupo."},
            headers=auth_headers("professional"),
        )

        assert response.status_code == 201, response.text
        body = response.json()
        assert body["areaLabel"] == "Psicológica"
        # Sin profesional indicado, revisó quien registra
        assert body["professionalName"] == "Lic. Ana Flores (demo)"

    def test_profesional_externo_o_del_equipo(self, client, auth_headers, patient_ids, db_session):
        from app.models import User

        headers = auth_headers("professional")
        today = clock.today().isoformat()
        external = client.post(
            evaluations_url(patient_ids["consent"]),
            json={
                "area": "fisica",
                "evaluatedOn": today,
                "professionalName": "Dr. Neurólogo Externo",
                "notes": "Control trimestral.",
            },
            headers=headers,
        )
        volunteer_id = db_session.scalar(
            select(User.id).where(User.email == "voluntario@aspar.org")
        )
        not_clinical = client.post(
            evaluations_url(patient_ids["consent"]),
            json={
                "area": "fisica",
                "evaluatedOn": today,
                "professionalId": str(volunteer_id),
                "notes": "Control trimestral.",
            },
            headers=headers,
        )

        assert external.json()["professionalId"] is None
        assert external.json()["professionalName"] == "Dr. Neurólogo Externo"
        assert not_clinical.status_code == 422
        assert "personal clínico" in not_clinical.json()["detail"]

    @pytest.mark.parametrize(
        ("changes", "message"),
        [
            ({"evaluatedOn": "FUTURO"}, "no puede ser futura"),
            ({"notes": "  "}, "observaciones"),
            ({"area": "nutricion"}, None),
        ],
    )
    def test_validaciones(self, client, auth_headers, patient_ids, changes, message):
        payload = {"area": "fisica", "evaluatedOn": clock.today().isoformat(), "notes": "Bien."}
        if changes.get("evaluatedOn") == "FUTURO":
            changes = {"evaluatedOn": (clock.today() + timedelta(days=1)).isoformat()}

        response = client.post(
            evaluations_url(patient_ids["consent"]),
            json=payload | changes,
            headers=auth_headers("professional"),
        )

        assert response.status_code == 422
        if message:
            assert message in response.json()["detail"]

    def test_corregir_queda_en_bitacora_y_no_hay_borrado(
        self, client, auth_headers, patient_ids, db_session
    ):
        headers = auth_headers("professional")
        patient = patient_ids["consent"]
        evaluation = client.get(evaluations_url(patient), headers=headers).json()[0]

        response = client.patch(
            evaluations_url(patient, evaluation["id"]),
            json={"notes": "Mejor equilibrio; seguir con marcha."},
            headers=headers,
        )

        assert response.status_code == 200
        assert response.json()["notes"] == "Mejor equilibrio; seguir con marcha."
        log = db_session.scalar(
            select(AuditLog).where(AuditLog.action == "Corrección de evaluación")
        )
        assert log.severity == "WARNING" and "notes" in log.detail
        assert (
            client.delete(evaluations_url(patient, evaluation["id"]), headers=headers).status_code
            == 405
        )
        cleared = client.patch(
            evaluations_url(patient, evaluation["id"]), json={"area": None}, headers=headers
        )
        assert cleared.status_code == 422

    def test_sin_consentimiento_nadie_ve_las_evaluaciones(self, client, auth_headers, patient_ids):
        for key in ("no_consent", "revoked"):
            response = client.get(evaluations_url(patient_ids[key]), headers=auth_headers())
            assert response.status_code == 403
            assert "RNF-06" in response.json()["detail"]

    def test_roles_sin_permiso_clinico(self, client, auth_headers, patient_ids):
        patient = patient_ids["consent"]

        assert (
            client.get(evaluations_url(patient), headers=auth_headers("reception")).status_code
            == 403
        )
        assert (
            client.get(evaluations_url(patient), headers=auth_headers("volunteer")).status_code
            == 403
        )
        assert (
            client.post(
                evaluations_url(patient),
                json={"area": "fisica", "evaluatedOn": "2026-10-01", "notes": "x"},
                headers=auth_headers("reception"),
            ).status_code
            == 403
        )

    def test_evaluacion_inexistente_es_404_y_ficha_sin_consentimiento_403(
        self, client, auth_headers, patient_ids
    ):
        import uuid

        headers = auth_headers("professional")
        evaluation = client.get(evaluations_url(patient_ids["consent"]), headers=headers).json()[0]

        missing = client.get(evaluations_url(patient_ids["consent"], uuid.uuid4()), headers=headers)
        other_patient = client.get(
            evaluations_url(patient_ids["revoked"], evaluation["id"]), headers=auth_headers()
        )
        found = client.get(
            evaluations_url(patient_ids["consent"], evaluation["id"]), headers=headers
        )

        assert missing.status_code == 404
        # La regla del consentimiento se revisa antes de buscar la evaluación
        assert other_patient.status_code == 403
        assert found.json()["id"] == evaluation["id"]
