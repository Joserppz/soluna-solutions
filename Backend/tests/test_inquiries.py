"""Solicitudes (diseño págs. 2 y 17): formulario público, seguimiento e inscripción."""

from datetime import timedelta

import pytest
from sqlalchemy import select

from app.core import clock
from app.models import AuditLog, Inquiry, Patient, Schedule
from tests.conftest import requires_db

pytestmark = requires_db

URL = "/api/v1/inquiries"
PUBLIC = "/api/v1/public/inquiries"
FORM = {
    "kind": "orientacion",
    "name": "Rosa Mamani",
    "phone": "71548214",
    "contactConsent": True,
    "turnstileToken": "humano",
}


def by_name(db_session, name):
    return db_session.scalar(select(Inquiry).where(Inquiry.name == name))


def next_saturday(db_session):
    return db_session.scalar(
        select(Schedule)
        .where(Schedule.status == "publicada", Schedule.date > clock.today())
        .order_by(Schedule.date)
    )


class TestFormularioPublico:
    @pytest.mark.parametrize(
        "changes",
        [
            {"kind": "orientacion", "onBehalfOf": "Su esposo, Julio", "preferredCallTime": "Tarde"},
            {"kind": "voluntariado", "message": "Puedo ayudar los sábados."},
            {"kind": "especie", "message": "Una silla de ruedas en buen estado."},
            {"kind": "otro"},
        ],
    )
    def test_cada_motivo_queda_como_solicitud_nueva(self, client, captcha, db_session, changes):
        response = client.post(PUBLIC, json=FORM | changes | {"name": "Persona Nueva"})

        assert response.status_code == 202, response.text
        assert "te llamará" in response.json()["message"]
        saved = by_name(db_session, "Persona Nueva")
        assert (saved.kind, saved.source, saved.status, saved.contact_consent) == (
            changes["kind"],
            "sitio",
            "recibida",
            True,
        )

    def test_quiero_participar_va_vinculado_a_la_actividad(self, client, captcha, db_session):
        schedule = next_saturday(db_session)

        response = client.post(
            PUBLIC,
            json=FORM | {"kind": "participar", "scheduleId": str(schedule.id), "name": "Ana Paz"},
        )

        assert response.status_code == 202
        assert by_name(db_session, "Ana Paz").schedule_id == schedule.id

    def test_participar_exige_una_actividad_abierta(self, client, captcha, db_session):
        cancelled = db_session.scalar(select(Schedule).where(Schedule.status == "cancelada"))
        draft = db_session.scalar(select(Schedule).where(Schedule.status == "borrador"))

        missing = client.post(PUBLIC, json=FORM | {"kind": "participar"})
        closed = client.post(
            PUBLIC, json=FORM | {"kind": "participar", "scheduleId": str(cancelled.id)}
        )
        unpublished = client.post(
            PUBLIC, json=FORM | {"kind": "participar", "scheduleId": str(draft.id)}
        )

        assert missing.status_code == 422
        assert closed.status_code == 409 and unpublished.status_code == 409

    @pytest.mark.parametrize(
        ("changes", "status"),
        [
            ({"contactConsent": False}, 422),
            ({"phone": "123"}, 422),
            ({"name": "Al"}, 422),
            ({"kind": "asistencia"}, 422),
            ({"turnstileToken": "robot"}, 400),
        ],
    )
    def test_validaciones(self, client, captcha, changes, status):
        assert client.post(PUBLIC, json=FORM | changes).status_code == status


class TestSeguimiento:
    def test_bandeja_con_contadores_busqueda_y_filtros(self, client, auth_headers):
        headers = auth_headers("reception")

        inbox = client.get(URL, headers=headers).json()
        new = client.get(URL, params={"status": "recibida"}, headers=headers).json()
        found = client.get(URL, params={"search": "julio"}, headers=headers).json()
        summary = client.get(f"{URL}/summary", headers=headers).json()

        assert inbox["total"] == 5
        assert new["total"] == 4
        assert [i["name"] for i in found["items"]] == ["Rosa Mamani"]
        assert found["items"][0]["kindLabel"] == "Orientación para participar"
        assert found["items"][0]["statusLabel"] == "Nueva"
        assert summary == {
            "recibida": 4,
            "porContactar": 0,
            "contactada": 1,
            "inscrita": 0,
            "cerrada": 0,
            "total": 5,
        }
        participar = next(i for i in inbox["items"] if i["kind"] == "participar")
        assert participar["scheduleTitle"] == "Movimiento en compañía"

    def test_estados_y_asignacion(self, client, auth_headers, db_session):
        from app.models import User

        headers = auth_headers("reception")
        inquiry = by_name(db_session, "Javier Condori")
        coordinator = db_session.scalar(select(User).where(User.email == "coordinacion@aspar.org"))

        assigned = client.patch(
            f"{URL}/{inquiry.id}",
            json={"status": "por_contactar", "assignedTo": str(coordinator.id)},
            headers=headers,
        )
        back_to_new = client.patch(
            f"{URL}/{inquiry.id}", json={"status": "recibida"}, headers=headers
        )
        enrolled = client.patch(f"{URL}/{inquiry.id}", json={"status": "inscrita"}, headers=headers)

        assert assigned.status_code == 200, assigned.text
        body = assigned.json()
        assert (body["status"], body["assignedToName"]) == ("por_contactar", "René Vargas (demo)")
        assert [n["note"] for n in body["notes"]] == [
            "Asignó la solicitud a René Vargas (demo).",
            "Cambió el estado a «Por contactar».",
        ]
        assert back_to_new.status_code == 409
        assert enrolled.status_code == 409

    def test_nota_de_la_llamada_y_marcar_como_contactada(self, client, auth_headers, db_session):
        inquiry = by_name(db_session, "Rosa Mamani")

        response = client.post(
            f"{URL}/{inquiry.id}/notes",
            json={"note": "Vendrá el sábado con su esposo.", "markContacted": True},
            headers=auth_headers("reception"),
        )

        assert response.status_code == 201
        body = response.json()
        assert body["status"] == "contactada"
        assert body["notes"][-1]["note"] == "Vendrá el sábado con su esposo."
        assert body["notes"][-1]["authorName"] == "Patricia Mendoza (demo)"

    def test_cerrar_y_reabrir(self, client, auth_headers, db_session):
        headers = auth_headers("reception")
        inquiry = by_name(db_session, "Elena Paredes")

        closed = client.patch(f"{URL}/{inquiry.id}", json={"status": "cerrada"}, headers=headers)
        reopened = client.patch(f"{URL}/{inquiry.id}", json={"status": "recibida"}, headers=headers)

        assert closed.json()["status"] == "cerrada"
        assert reopened.json()["status"] == "recibida"

    def test_permisos(self, client, auth_headers):
        assert client.get(URL, headers=auth_headers("volunteer")).status_code == 403
        assert client.get(URL, headers=auth_headers("professional")).status_code == 403


class TestInscribirComoAfiliado:
    def test_precarga_y_quien_escribio_queda_como_contacto(self, client, auth_headers, db_session):
        headers = auth_headers("reception")
        inquiry = by_name(db_session, "Rosa Mamani")

        draft = client.get(f"{URL}/{inquiry.id}/patient-draft", headers=headers).json()
        response = client.post(
            f"{URL}/{inquiry.id}/convert-to-patient", json={"ci": "8899001"}, headers=headers
        )

        assert draft["name"] == "Su esposo, Julio" and draft["phone"] == "71548214"
        assert draft["contacts"][0]["name"] == "Rosa Mamani"
        assert response.status_code == 201, response.text
        patient = response.json()
        assert (patient["name"], patient["phone"], patient["zone"]) == (
            "Su esposo, Julio",
            "71548214",
            "Villa Fátima",
        )
        assert patient["consent"] is False and patient["accessStatus"] == "Pendiente"
        assert [(c["name"], c["isPrimary"]) for c in patient["contacts"]] == [("Rosa Mamani", True)]
        detail = client.get(f"{URL}/{inquiry.id}", headers=headers).json()
        assert (detail["status"], detail["patientId"]) == ("inscrita", patient["id"])
        assert db_session.scalar(
            select(AuditLog).where(AuditLog.action == "Inscripción de solicitud como afiliado")
        )

    def test_con_nombre_corregido_y_contactos_propios(self, client, auth_headers, db_session):
        inquiry = by_name(db_session, "Javier Condori")

        response = client.post(
            f"{URL}/{inquiry.id}/convert-to-patient",
            json={
                "ci": "5566001",
                "name": "Javier Condori Mamani",
                "contacts": [{"name": "Luz Mamani", "relation": "Esposa", "phone": "70011223"}],
            },
            headers=auth_headers("reception"),
        )

        assert response.json()["name"] == "Javier Condori Mamani"
        assert db_session.scalar(select(Patient).where(Patient.ci == "5566001"))

    def test_sin_contacto_o_ya_inscrita(self, client, auth_headers, db_session):
        headers = auth_headers("reception")
        inquiry = by_name(db_session, "Javier Condori")

        no_contact = client.post(
            f"{URL}/{inquiry.id}/convert-to-patient", json={"ci": "5566002"}, headers=headers
        )
        duplicated_ci = client.post(
            f"{URL}/{inquiry.id}/convert-to-patient",
            json={
                "ci": "1234567",
                "contacts": [{"name": "Luz Mamani", "relation": "Esposa", "phone": "70011223"}],
            },
            headers=headers,
        )

        assert no_contact.status_code == 422
        assert "al menos un contacto" in no_contact.json()["detail"]
        assert duplicated_ci.status_code == 409
        assert by_name(db_session, "Javier Condori").status == "recibida"

    def test_inscribir_exige_poder_registrar_afiliados(self, client, auth_headers, db_session):
        admin_headers = auth_headers()
        client.put(
            "/api/v1/roles/volunteer/permissions",
            json={"permissions": ["attendance:write", "patients:read", "inquiries:manage"]},
            headers=admin_headers,
        )
        inquiry = by_name(db_session, "Elena Paredes")

        response = client.post(
            f"{URL}/{inquiry.id}/convert-to-patient",
            json={"ci": "5566003"},
            headers=auth_headers("volunteer"),
        )

        assert response.status_code == 403
        assert client.get(URL, headers=auth_headers("volunteer")).status_code == 200


def test_solicitudes_de_una_actividad_pasada_no_se_aceptan(
    client, captcha, auth_headers, db_session
):
    past = db_session.scalar(
        select(Schedule).where(Schedule.status == "publicada", Schedule.date <= clock.today())
    )
    if past.date == clock.today():
        past.date = clock.today() - timedelta(days=7)
        db_session.flush()

    response = client.post(PUBLIC, json=FORM | {"kind": "participar", "scheduleId": str(past.id)})

    assert response.status_code == 409
