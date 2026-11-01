"""Listado de afiliados (diseño pág. 8) y pestaña Asistencia de la ficha (pág. 9).

Pestañas con contadores, filtro por actividad, orden, actividades de cada ficha y
«X de Y sábados este trimestre».
"""

import datetime as dt
import itertools

import pytest
from sqlalchemy import func, select

from app.core import clock
from app.models import Attendance, Patient, Schedule
from app.modules.attendance.service import quarter_of
from tests.conftest import requires_db

pytestmark = requires_db

PATIENTS = "/api/v1/patients"
_ci = itertools.count(8100001)


def new_patient(client, headers, name, consent=True):
    response = client.post(
        PATIENTS,
        json={
            "name": name,
            "ci": str(next(_ci)),
            "phone": "71234567",
            "consent": consent,
            "accessStatus": "Activo" if consent else "Pendiente",
            "contacts": [{"name": "Ana Familiar", "relation": "Hija", "phone": "70011223"}],
        },
        headers=headers,
    )
    assert response.status_code == 201, response.text
    return response.json()["id"]


def schedule(db_session, day, category="fisioterapia", status="publicada", title="Taller"):
    item = Schedule(
        title=title,
        category=category,
        date=day,
        start_time=dt.time(10),
        end_time=dt.time(11, 30),
        location="Sede ASPAR",
        status=status,
        professional_name="",
        description="",
        cancellation_note="Lluvia" if status == "cancelada" else None,
    )
    db_session.add(item)
    db_session.flush()
    return item


def attend(db_session, schedule_item, patient_id, status="vino", note=""):
    db_session.add(
        Attendance(schedule_id=schedule_item.id, patient_id=patient_id, status=status, note=note)
    )
    db_session.flush()


def saturdays_this_quarter() -> list[dt.date]:
    today = clock.today()
    _, first = quarter_of(today)
    days = [first + dt.timedelta(days=n) for n in range((today - first).days + 1)]
    return [day for day in days if day.weekday() == 5]


class TestPestanasYContadores:
    def test_los_contadores_suman_y_coinciden_con_la_base(self, client, auth_headers, db_session):
        counts = client.get(f"{PATIENTS}/summary", headers=auth_headers("reception")).json()

        active = Patient.deleted_at.is_(None)
        assert counts["all"] == db_session.scalar(select(func.count()).select_from(Patient))
        assert counts["active"] == db_session.scalar(select(func.count()).where(active))
        assert counts["consentPending"] == db_session.scalar(
            select(func.count()).where(active, Patient.consent.is_(False))
        )
        assert counts["all"] == counts["active"] + counts["inactive"]

    def test_dar_de_baja_mueve_la_ficha_de_pestana(self, client, auth_headers):
        admin = auth_headers("admin")
        patient_id = new_patient(client, admin, "Zoila Pestaña", consent=False)
        before = client.get(f"{PATIENTS}/summary", headers=admin).json()

        client.post(
            f"{PATIENTS}/{patient_id}/deactivate", json={"reason": "Se mudó"}, headers=admin
        )
        after = client.get(f"{PATIENTS}/summary", headers=admin).json()

        assert after["active"] == before["active"] - 1
        assert after["inactive"] == before["inactive"] + 1
        assert after["consentPending"] == before["consentPending"] - 1
        assert after["all"] == before["all"]

    def test_cada_pestana_lista_lo_suyo(self, client, auth_headers):
        headers = auth_headers("coordination")

        def rows(group):
            return client.get(f"{PATIENTS}?group={group}&limit=200", headers=headers).json()

        counts = client.get(f"{PATIENTS}/summary", headers=headers).json()
        inactive, pending, everyone = rows("inactive"), rows("consent_pending"), rows("all")

        assert inactive["total"] == counts["inactive"]
        assert all(not row["active"] for row in inactive["items"])
        assert pending["total"] == counts["consentPending"]
        assert all(row["active"] and not row["consent"] for row in pending["items"])
        assert everyone["total"] == counts["all"]
        assert rows("active")["total"] == counts["active"]

    def test_los_contadores_respetan_la_busqueda(self, client, auth_headers):
        headers = auth_headers("coordination")
        patient_id = new_patient(client, headers, "Wilfredo Únicoapellido", consent=False)

        def counts():
            return client.get(f"{PATIENTS}/summary?search=Únicoapellido", headers=headers).json()

        assert {k: v for k, v in counts().items() if k != "activities"} == {
            "all": 1,
            "active": 1,
            "consentPending": 1,
            "inactive": 0,
        }
        client.post(
            f"{PATIENTS}/{patient_id}/deactivate",
            json={"reason": "Se mudó"},
            headers=auth_headers("admin"),
        )
        assert counts()["inactive"] == 1
        assert counts()["active"] == 0

    def test_pestana_u_orden_desconocidos_responden_422(self, client, auth_headers):
        headers = auth_headers("coordination")

        assert client.get(f"{PATIENTS}?group=todos", headers=headers).status_code == 422
        assert client.get(f"{PATIENTS}?order=edad", headers=headers).status_code == 422
        assert client.get(f"{PATIENTS}?activity=yoga", headers=headers).status_code == 422


class TestOrden:
    def test_por_nombre_ascendente_y_descendente(self, client, auth_headers):
        headers = auth_headers("coordination")

        def names(order):
            items = client.get(
                f"{PATIENTS}?group=all&order={order}&limit=200", headers=headers
            ).json()["items"]
            return [row["name"] for row in items]

        ascending = names("name")
        assert ascending == sorted(ascending, key=str.lower)
        assert names("-name") == list(reversed(ascending))

    def test_por_fecha_de_alta(self, client, auth_headers):
        headers = auth_headers("coordination")

        def dates(order):
            items = client.get(
                f"{PATIENTS}?group=all&order={order}&limit=200", headers=headers
            ).json()["items"]
            return [row["createdAt"] for row in items]

        assert dates("recent") == sorted(dates("recent"), reverse=True)
        assert dates("oldest") == sorted(dates("oldest"))


class TestActividades:
    def test_la_fila_muestra_las_actividades_de_los_ultimos_seis_meses(
        self, client, auth_headers, db_session
    ):
        headers = auth_headers("coordination")
        patient_id = new_patient(client, headers, "Teodora Actividades")
        today = clock.today()
        for _ in range(2):
            attend(db_session, schedule(db_session, today - dt.timedelta(days=7)), patient_id)
        attend(
            db_session, schedule(db_session, today - dt.timedelta(days=14), "teatro"), patient_id
        )
        # No cuentan: hace más de 6 meses, o no vino
        attend(
            db_session,
            schedule(db_session, today - dt.timedelta(days=400), "psicologia"),
            patient_id,
        )
        attend(
            db_session,
            schedule(db_session, today - dt.timedelta(days=3), "arteterapia"),
            patient_id,
            status="no_vino",
        )

        row = client.get(f"{PATIENTS}?search=Teodora", headers=headers).json()["items"][0]

        assert row["activities"] == [
            {"category": "fisioterapia", "label": "Fisioterapia"},
            {"category": "teatro", "label": "Teatro"},
        ]

    def test_filtrar_por_actividad(self, client, auth_headers, db_session):
        headers = auth_headers("coordination")
        actor = new_patient(client, headers, "Octavio Teatro")
        other = new_patient(client, headers, "Paula Sinteatro")
        play = schedule(db_session, clock.today() - dt.timedelta(days=10), "teatro")
        attend(db_session, play, actor)
        attend(db_session, play, other, status="no_vino")

        found = client.get(f"{PATIENTS}?activity=teatro&limit=200", headers=headers).json()
        names = [row["name"] for row in found["items"]]
        counts = client.get(f"{PATIENTS}/summary?activity=teatro", headers=headers).json()

        assert "Octavio Teatro" in names
        assert "Paula Sinteatro" not in names
        assert counts["active"] == found["total"]
        option = next(o for o in counts["activities"] if o["category"] == "teatro")
        assert option == {"category": "teatro", "label": "Teatro", "patients": counts["active"]}

    def test_el_filtro_ofrece_todas_las_actividades(self, client, auth_headers):
        counts = client.get(f"{PATIENTS}/summary", headers=auth_headers("volunteer")).json()

        assert [o["category"] for o in counts["activities"]] == [
            "fisioterapia",
            "arteterapia",
            "fonoaudiologia",
            "psicologia",
            "teatro",
            "familias",
            "comunitario",
        ]
        assert all(o["patients"] >= 0 for o in counts["activities"])


class TestAsistenciaDelAfiliado:
    def test_cuenta_los_sabados_del_trimestre(self, client, auth_headers, db_session):
        saturdays = saturdays_this_quarter()
        if not saturdays:
            pytest.skip("El trimestre todavía no tiene sábados")
        headers = auth_headers("coordination")
        patient_id = new_patient(client, headers, "Sabina Sábados")
        url = f"{PATIENTS}/{patient_id}/attendance"
        before = client.get(url, headers=headers).json()

        attend(db_session, schedule(db_session, saturdays[0]), patient_id)
        # No suman: un día que no es sábado, una actividad cancelada y otra en borrador
        weekday = saturdays[0] - dt.timedelta(days=1)
        if weekday >= quarter_of(clock.today())[1]:
            attend(db_session, schedule(db_session, weekday), patient_id)
        attend(db_session, schedule(db_session, saturdays[-1], status="cancelada"), patient_id)
        attend(db_session, schedule(db_session, saturdays[-1], status="borrador"), patient_id)
        after = client.get(url, headers=headers).json()

        assert before["saturdaysAttended"] == 0
        assert after["saturdaysAttended"] == 1
        assert after["saturdaysHeld"] >= 1
        assert after["saturdaysHeld"] - before["saturdaysHeld"] in (0, 1)
        assert after["quarterStart"] == quarter_of(clock.today())[1].isoformat()

    def test_historial_de_la_mas_reciente_a_la_mas_antigua(self, client, auth_headers, db_session):
        headers = auth_headers("volunteer")
        patient_id = new_patient(client, auth_headers("coordination"), "Hilda Historial")
        today = clock.today()
        attend(
            db_session,
            schedule(db_session, today - dt.timedelta(days=30), title="Arte"),
            patient_id,
        )
        attend(
            db_session,
            schedule(db_session, today - dt.timedelta(days=2), "teatro", title="Teatro"),
            patient_id,
            status="no_vino",
            note="Avisó que estaba resfriada",
        )
        attend(
            db_session,
            schedule(db_session, today - dt.timedelta(days=9), title="Sin marcar"),
            patient_id,
            status="sin_marcar",
        )

        page = client.get(f"{PATIENTS}/{patient_id}/attendance?limit=1", headers=headers).json()
        rest = client.get(
            f"{PATIENTS}/{patient_id}/attendance?limit=1&offset=1", headers=headers
        ).json()

        assert page["total"] == 2
        assert page["items"][0] | {"scheduleId": None} == {
            "scheduleId": None,
            "title": "Teatro",
            "category": "teatro",
            "categoryLabel": "Teatro",
            "date": (today - dt.timedelta(days=2)).isoformat(),
            "status": "no_vino",
            "note": "Avisó que estaba resfriada",
        }
        assert [row["title"] for row in rest["items"]] == ["Arte"]

    def test_permisos_y_ficha_inexistente(self, client, auth_headers):
        url = f"{PATIENTS}/00000000-0000-0000-0000-000000000000/attendance"

        assert client.get(url, headers=auth_headers("volunteer")).status_code == 404
        assert client.get(url, headers=auth_headers(None)).status_code == 403
        assert client.get(url).status_code == 401


@pytest.mark.parametrize(
    ("day", "label", "first"),
    [
        (dt.date(2026, 1, 1), "enero a marzo de 2026", dt.date(2026, 1, 1)),
        (dt.date(2026, 6, 30), "abril a junio de 2026", dt.date(2026, 4, 1)),
        (dt.date(2026, 8, 15), "julio a septiembre de 2026", dt.date(2026, 7, 1)),
        (dt.date(2026, 11, 1), "octubre a diciembre de 2026", dt.date(2026, 10, 1)),
    ],
)
def test_trimestre_de_una_fecha(day, label, first):
    assert quarter_of(day) == (label, first)
