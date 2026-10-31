"""Agenda de actividades (diseño págs. 2, 3 y 12): estados, cupos y agenda pública."""

from datetime import timedelta

import pytest
from sqlalchemy import select

from app.core import clock
from app.models import AuditLog, Inquiry
from tests.conftest import requires_db

pytestmark = requires_db

URL = "/api/v1/schedules"
PUBLIC = "/api/v1/public/schedules"


def new_activity(**changes):
    return {
        "title": "Movimiento en compañía",
        "category": "fisioterapia",
        "date": (clock.today() + timedelta(days=10)).isoformat(),
        "startTime": "10:00",
        "endTime": "11:30",
        "location": "Sede ASPAR",
        "professionalName": "Lic. Ana Flores",
        "description": "Movimiento suave y conversación.",
        "spots": 30,
    } | changes


def create(client, headers, **changes):
    response = client.post(URL, json=new_activity(**changes), headers=headers)
    assert response.status_code == 201, response.text
    return response.json()


def test_la_agenda_interna_incluye_borradores_y_va_por_fecha(client, auth_headers):
    body = client.get(URL, headers=auth_headers("coordination")).json()

    statuses = {item["status"] for item in body["items"]}
    assert statuses == {"borrador", "publicada", "cancelada"}
    dates = [(item["date"], item["startTime"]) for item in body["items"]]
    assert dates == sorted(dates)
    assert body["items"][0]["categoryLabel"] == "Fisioterapia"


def test_quien_toma_asistencia_ve_la_agenda_pero_no_la_edita(client, auth_headers):
    volunteer = auth_headers("volunteer")

    assert client.get(URL, headers=volunteer).status_code == 200
    assert client.post(URL, json=new_activity(), headers=volunteer).status_code == 403
    assert client.get(URL, headers=auth_headers(None)).status_code == 403


def test_filtrar_por_rango_y_estado(client, auth_headers):
    headers = auth_headers("coordination")
    today = clock.today()

    drafts = client.get(URL, params={"status": "borrador"}, headers=headers).json()
    upcoming = client.get(
        URL,
        params={"from": today.isoformat(), "to": (today + timedelta(days=60)).isoformat()},
        headers=headers,
    ).json()

    assert [i["title"] for i in drafts["items"]] == ["Preparación de diciembre"]
    assert all(i["date"] >= today.isoformat() for i in upcoming["items"])


def test_crear_en_borrador_publicar_y_volver_a_borrador(client, auth_headers, db_session):
    headers = auth_headers("coordination")
    activity = create(client, headers)
    assert activity["status"] == "borrador"
    assert activity["availability"] == "libres"

    published = client.post(f"{URL}/{activity['id']}/publish", headers=headers)
    assert published.json()["status"] == "publicada"
    assert client.post(f"{URL}/{activity['id']}/publish", headers=headers).status_code == 409

    back = client.post(f"{URL}/{activity['id']}/unpublish", headers=headers)
    assert back.json()["status"] == "borrador"
    assert db_session.scalar(select(AuditLog).where(AuditLog.action == "Publicación de actividad"))


def test_crear_directamente_publicada_con_profesional_del_equipo(client, auth_headers, db_session):
    from app.models import User

    professional = db_session.scalar(select(User).where(User.email == "profesional@aspar.org"))
    activity = create(
        client,
        auth_headers("coordination"),
        publish=True,
        professionalId=str(professional.id),
        professionalName="se ignora",
    )

    assert activity["status"] == "publicada"
    assert activity["professionalName"] == professional.name


def test_cancelar_con_aviso_sigue_visible_y_ya_no_se_edita(client, auth_headers):
    headers = auth_headers("coordination")
    activity = create(client, headers, publish=True)

    no_note = client.post(f"{URL}/{activity['id']}/cancel", json={"note": ""}, headers=headers)
    cancelled = client.post(
        f"{URL}/{activity['id']}/cancel",
        json={"note": "Se reprogramará en diciembre"},
        headers=headers,
    )

    assert no_note.status_code == 422
    assert cancelled.json()["status"] == "cancelada"
    assert cancelled.json()["cancellationNote"] == "Se reprogramará en diciembre"
    public = client.get(PUBLIC).json()
    assert any(p["id"] == activity["id"] and p["status"] == "cancelada" for p in public)
    edit = client.patch(f"{URL}/{activity['id']}", json={"title": "Otro"}, headers=headers)
    assert edit.status_code == 409
    assert client.post(f"{URL}/{activity['id']}/publish", headers=headers).status_code == 409


def test_editar_actividad(client, auth_headers):
    headers = auth_headers("coordination")
    activity = create(client, headers)

    response = client.patch(
        f"{URL}/{activity['id']}",
        json={
            "title": "Movimiento y respiración",
            "spots": 25,
            "imageUrl": "https://cdn.aspar.com/a.jpg",
        },
        headers=headers,
    )

    assert response.status_code == 200
    assert response.json()["title"] == "Movimiento y respiración"
    assert response.json()["spots"] == 25


@pytest.mark.parametrize(
    ("changes", "message"),
    [
        ({"endTime": "09:00"}, "hora de fin"),
        ({"title": "  "}, "título"),
        ({"location": "x"}, "lugar"),
        ({"imageUrl": "http://inseguro.com/a.jpg"}, "https://"),
        ({"category": "yoga"}, None),
        ({"spots": 900}, None),
    ],
)
def test_validaciones(client, auth_headers, changes, message):
    response = client.post(URL, json=new_activity(**changes), headers=auth_headers("coordination"))

    assert response.status_code == 422
    if message:
        assert message in response.json()["detail"]


def test_solo_se_eliminan_borradores(client, auth_headers):
    headers = auth_headers("coordination")
    draft = create(client, headers)
    published = create(client, headers, publish=True)

    assert client.delete(f"{URL}/{published['id']}", headers=headers).status_code == 409
    assert client.delete(f"{URL}/{draft['id']}", headers=headers).status_code == 200
    assert client.get(f"{URL}/{draft['id']}", headers=headers).status_code == 404


def test_cupos_informativos_segun_solicitudes_para_participar(client, auth_headers, db_session):
    headers = auth_headers("coordination")
    activity = create(client, headers, publish=True, spots=5)

    def interested(n):
        for i in range(n):
            db_session.add(
                Inquiry(
                    kind="participar",
                    name=f"Persona {i}",
                    phone="70000000",
                    schedule_id=activity["id"],
                )
            )
        db_session.flush()
        return client.get(f"{URL}/{activity['id']}", headers=headers).json()

    assert interested(2)["availability"] == "libres"
    after = interested(1)
    assert after["interested"] == 3 and after["availability"] == "ultimos"
    assert interested(2)["availability"] == "completo"


class TestAgendaPublica:
    def test_sin_sesion_solo_publicadas_y_canceladas_sin_datos_del_equipo(self, client):
        client.cookies.clear()
        response = client.get(PUBLIC)

        assert response.status_code == 200
        body = response.json()
        assert body and {item["status"] for item in body} <= {"publicada", "cancelada"}
        assert "Preparación de diciembre" not in {item["title"] for item in body}
        assert all(item["date"] >= clock.today().isoformat() for item in body)
        assert not {"professionalName", "professionalId", "interested"} & set(body[0])
        teatro = next(item for item in body if item["category"] == "teatro")
        assert teatro["cancellationNote"] == "Se reprogramará en diciembre"

    def test_rango_de_fechas(self, client):
        today = clock.today()
        past = client.get(
            PUBLIC,
            params={"from": (today - timedelta(days=8)).isoformat(), "to": today.isoformat()},
        ).json()
        inverted = client.get(
            PUBLIC,
            params={"from": today.isoformat(), "to": (today - timedelta(days=1)).isoformat()},
        )
        too_long = client.get(
            PUBLIC,
            params={"from": today.isoformat(), "to": (today + timedelta(days=400)).isoformat()},
        )

        assert [item["title"] for item in past] == ["Movimiento en compañía"]
        assert inverted.status_code == 422
        assert too_long.status_code == 422
