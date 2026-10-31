"""Resumen del panel (diseño pág. 7)."""

from datetime import timedelta

from sqlalchemy import select

from app.core import clock
from app.models import Patient
from tests.conftest import requires_db

pytestmark = requires_db

URL = "/api/v1/dashboard/summary"


def test_resumen_completo_para_administracion(client, auth_headers, db_session):
    body = client.get(URL, headers=auth_headers()).json()

    assert body["toReview"] == {
        "newInquiries": 4,
        "donationsToConfirm": 2,
        "patientsWithoutConsent": 1,
        "damagedItems": 1,
    }
    first_of_month = clock.today().replace(day=1)
    joined = sum(
        p.created_at.astimezone(clock.BOLIVIA).date() >= first_of_month
        for p in db_session.scalars(select(Patient))
    )
    assert body["patients"] == {"active": 3, "joinedThisMonth": joined, "withoutConsent": 1}
    upcoming = body["upcoming"]
    assert len(upcoming) == 4
    assert [u["date"] for u in upcoming] == sorted(u["date"] for u in upcoming)
    first_published = next(u for u in upcoming if u["status"] == "publicada")
    assert body["nextActivity"]["id"] == first_published["id"]


def test_proxima_actividad_con_asistencia_habitual_e_inscripciones(client, auth_headers):
    next_activity = client.get(URL, headers=auth_headers()).json()["nextActivity"]

    assert next_activity["title"] == "Movimiento en compañía"
    if clock.today().weekday() == 5:
        # Hoy es sábado: la próxima es la de hoy y no hay sábados anteriores del mismo tipo
        assert next_activity["date"] == clock.today().isoformat()
        assert (next_activity["usualAttendance"], next_activity["newSignups"]) == (None, 0)
    else:
        # La del próximo sábado: el pasado vino 1 persona y hay 1 «Quiero participar»
        assert next_activity["date"] > clock.today().isoformat()
        assert (next_activity["usualAttendance"], next_activity["newSignups"]) == (1, 1)


def test_asistencia_de_los_ultimos_ocho_sabados(client, auth_headers):
    saturdays = client.get(URL, headers=auth_headers()).json()["attendanceLastSaturdays"]

    assert len(saturdays) == 8
    dates = [s["date"] for s in saturdays]
    assert dates == sorted(dates)
    assert dates[-1] <= clock.today().isoformat()
    assert dates[-1] > (clock.today() - timedelta(days=7)).isoformat()
    assert saturdays[-1]["came"] == 1
    assert sum(s["came"] for s in saturdays) == 1


def test_cada_rol_ve_solo_lo_suyo(client, auth_headers):
    volunteer = client.get(URL, headers=auth_headers("volunteer")).json()
    reception = client.get(URL, headers=auth_headers("reception")).json()

    assert volunteer["toReview"] == {
        "newInquiries": None,
        "donationsToConfirm": None,
        "patientsWithoutConsent": 1,
        "damagedItems": None,
    }
    assert volunteer["nextActivity"] is not None
    assert reception["toReview"]["donationsToConfirm"] == 2
    assert reception["toReview"]["damagedItems"] is None


def test_una_cuenta_pendiente_no_ve_el_panel(client, auth_headers):
    assert client.get(URL, headers=auth_headers(None)).status_code == 403
