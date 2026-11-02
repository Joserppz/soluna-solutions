"""Registro de actividad (diseño pág. 19): áreas, búsqueda por persona o afiliado,
últimos días, situaciones para revisar, resumen semanal y descarga."""

import csv
import io
from datetime import UTC, datetime, timedelta

from openpyxl import load_workbook
from sqlalchemy import select

from app.models import AuditLog
from tests.conftest import requires_db

pytestmark = requires_db

AUDIT = "/api/v1/audit"


def event(db_session, *, days_ago=0, actor="admin@aspar.org", **fields):
    """Un movimiento con fecha conocida (la API no permite escribir en la bitácora)."""
    when = datetime.now(UTC) - timedelta(days=days_ago, minutes=1)
    entry = AuditLog(
        date=when,
        last_occurred_at=when,
        actor=actor,
        actor_role=fields.pop("actor_role", "Administración"),
        category=fields.pop("category", "PACIENTES"),
        severity=fields.pop("severity", "INFO"),
        action=fields.pop("action", "Actualización de ficha de afiliado"),
        detail=fields.pop("detail", "Editó una ficha"),
        occurrences=1,
    )
    db_session.add(entry)
    db_session.flush()
    return entry


def ids(response):
    assert response.status_code == 200, response.text
    return {item["id"] for item in response.json()["items"]}


class TestFiltros:
    def test_por_area_agrupa_las_categorias(self, client, auth_headers, db_session):
        consent = event(db_session, category="CONSENTIMIENTO", action="Cambio de consentimiento")
        donation = event(db_session, category="DONACIONES", action="Confirmación de aporte")
        headers = auth_headers()

        afiliados = ids(client.get(f"{AUDIT}?area=afiliados&limit=200", headers=headers))
        donaciones = ids(client.get(f"{AUDIT}?area=donaciones&limit=200", headers=headers))

        assert str(consent.id) in afiliados and str(donation.id) not in afiliados
        assert str(donation.id) in donaciones
        assert client.get(f"{AUDIT}?area=cocina", headers=headers).status_code == 422

    def test_busca_por_persona_del_equipo_o_por_afiliado(self, client, auth_headers, db_session):
        by_name = event(db_session, actor="profesional@aspar.org", detail="Registró una evaluación")
        by_patient = event(db_session, detail="Editó la ficha de Alba Gutiérrez Mamani (uuid)")
        other = event(db_session, detail="Editó otra ficha")
        headers = auth_headers()

        # «Ana Flores» es el nombre de la cuenta profesional@aspar.org
        team = ids(client.get(f"{AUDIT}?search=ana%20flores&limit=200", headers=headers))
        patient = ids(client.get(f"{AUDIT}?search=Gutiérrez&limit=200", headers=headers))
        email = ids(client.get(f"{AUDIT}?search=profesional@&limit=200", headers=headers))

        assert str(by_name.id) in team and str(other.id) not in team
        assert str(by_patient.id) in patient and str(other.id) not in patient
        assert str(by_name.id) in email
        item = next(
            row
            for row in client.get(f"{AUDIT}?search=ana%20flores", headers=headers).json()["items"]
            if row["id"] == str(by_name.id)
        )
        assert item["actorName"] == "Lic. Ana Flores (demo)"

    def test_ultimos_dias(self, client, auth_headers, db_session):
        recent = event(db_session, days_ago=2)
        old = event(db_session, days_ago=20)
        headers = auth_headers()

        week = ids(client.get(f"{AUDIT}?days=7&limit=200", headers=headers))
        month = ids(client.get(f"{AUDIT}?days=30&limit=200", headers=headers))

        assert str(recent.id) in week and str(old.id) not in week
        assert str(old.id) in month
        assert client.get(f"{AUDIT}?days=0", headers=headers).status_code == 422

    def test_situaciones_para_revisar(self, client, auth_headers, db_session):
        blocked = event(
            db_session,
            category="SISTEMA",
            severity="WARNING",
            action="Intento de acceso restringido bloqueado",
            actor="voluntario@aspar.org",
        )
        cancelled = event(
            db_session,
            category="DONACIONES",
            severity="WARNING",
            action="Anulación de aviso de aporte",
        )
        normal = event(db_session)
        headers = auth_headers()

        found = client.get(f"{AUDIT}?review=true&limit=200", headers=headers).json()["items"]
        kinds = {item["id"]: item["review"] for item in found}

        assert kinds[str(blocked.id)] == "acceso_bloqueado"
        assert kinds[str(cancelled.id)] == "aporte_anulado"
        assert str(normal.id) not in kinds
        assert all(item["review"] for item in found)


class TestResumenSemanal:
    def test_cuenta_por_area_y_situaciones_para_revisar(self, client, auth_headers, db_session):
        headers = auth_headers()
        before = client.get(f"{AUDIT}/summary", headers=headers).json()
        event(db_session, category="SOLICITUDES", action="Solicitud recibida desde el sitio")
        event(db_session, category="USUARIOS_ROLES", action="Alta de usuario")
        event(db_session, category="SOLICITUDES", days_ago=10)
        event(db_session, category="DONACIONES", action="Anulación de aviso de aporte")
        event(
            db_session,
            category="AUTENTICACION",
            severity="CRITICAL",
            action="Cuenta bloqueada por intentos fallidos",
        )

        after = client.get(f"{AUDIT}/summary", headers=headers).json()
        count = {area["area"]: area["count"] for area in after["areas"]}
        old = {area["area"]: area["count"] for area in before["areas"]}

        assert after["days"] == 7
        assert [area["label"] for area in after["areas"]][:5] == [
            "Afiliados",
            "Accesos",
            "Donaciones",
            "Solicitudes",
            "Equipo",
        ]
        # El de hace 10 días no cuenta en la semana; el resumen de esta consulta sí suma
        assert count["solicitudes"] == old["solicitudes"] + 1
        assert count["equipo"] == old["equipo"] + 1
        assert after["review"]["cancelledDonations"] == before["review"]["cancelledDonations"] + 1
        assert after["review"]["blockedAccess"] == before["review"]["blockedAccess"] + 1
        assert after["review"]["total"] == (
            after["review"]["blockedAccess"] + after["review"]["cancelledDonations"]
        )
        month = client.get(f"{AUDIT}/summary?days=30", headers=headers).json()
        assert {a["area"]: a["count"] for a in month["areas"]}["solicitudes"] >= count[
            "solicitudes"
        ] + 1

    def test_solo_administracion(self, client, auth_headers):
        assert (
            client.get(f"{AUDIT}/summary", headers=auth_headers("coordination")).status_code == 403
        )
        assert client.get(f"{AUDIT}/export", headers=auth_headers("reception")).status_code == 403
        assert client.get(f"{AUDIT}/summary").status_code == 401


class TestDescarga:
    def test_descarga_lo_filtrado_y_queda_registrada(self, client, auth_headers, db_session):
        target = event(
            db_session,
            category="DONACIONES",
            action="Anulación de aviso de aporte",
            detail='=HYPERLINK("x") · Motivo: no estaba en el extracto',
        )
        headers = auth_headers()

        response = client.get(f"{AUDIT}/export?format=csv&area=donaciones&days=7", headers=headers)

        assert response.status_code == 200
        assert response.headers["content-type"].startswith("text/csv")
        assert "registro-de-actividad-" in response.headers["content-disposition"]
        rows = list(csv.reader(io.StringIO(response.content.decode("utf-8-sig")), delimiter=";"))
        assert rows[0][:3] == ["Fecha", "Hora", "Persona"]
        line = next(row for row in rows[1:] if "no estaba en el extracto" in row[7])
        assert line[5] == "Donaciones"
        assert line[9] == "Aporte anulado"
        # Un texto que empieza con «=» no se ejecuta como fórmula en Excel
        assert line[7].startswith("'=")
        assert all(row[5] == "Donaciones" for row in rows[1:])
        assert str(target.id)  # la fila existe en la base
        logged = db_session.scalar(
            select(AuditLog).where(AuditLog.action == "Descarga del registro de actividad")
        )
        assert logged is not None

    def test_excel(self, client, auth_headers):
        response = client.get(f"{AUDIT}/export", headers=auth_headers())

        assert response.status_code == 200
        sheet = load_workbook(io.BytesIO(response.content)).active
        assert sheet.title == "Registro de actividad"
        assert sheet.cell(row=1, column=7).value == "Acción"
        assert sheet.max_row >= 2
