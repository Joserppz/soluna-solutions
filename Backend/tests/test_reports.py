"""Filtro por rango de fechas y reportes descargables en cada pantalla (evaluación de los
Sprints 1 y 2).

- El rango incluye los dos días, en hora de Bolivia, tanto en columnas de fecha como en
  las de fecha y hora.
- La descarga trae exactamente las filas del filtro: ni solo la página que se ve, ni filas
  de fuera del filtro. Si pasan el tope, se pide acotar en vez de cortar.
- Descargar exige el permiso de la pantalla y ``reports:export``.
- Cada descarga queda en el registro de actividad y en el log con su filtro y sus filas.
"""

import csv
import datetime as dt
import io
import itertools
import logging

import pytest
from openpyxl import load_workbook
from sqlalchemy import select

from app.core import clock, reports
from app.core.reports import DateRange, day_start
from app.models import AuditLog, InventoryItem, Patient
from tests.conftest import requires_db

API = "/api/v1"
_ci = itertools.count(9300001)


def csv_rows(response) -> list[list[str]]:
    """Filas de datos de un CSV de una sola hoja (sin el encabezado)."""
    assert response.status_code == 200, response.text
    rows = list(csv.reader(io.StringIO(response.content.decode("utf-8-sig")), delimiter=";"))
    return rows[1:]


def total(client, headers, path, **params) -> int:
    response = client.get(f"{API}{path}", params={**params, "limit": 1}, headers=headers)
    assert response.status_code == 200, response.text
    return response.json()["total"]


# ---------------------------------------------------------------------------
# Rango de fechas (sin base de datos)
# ---------------------------------------------------------------------------
class TestRango:
    def test_etiquetas(self):
        assert DateRange(dt.date(2026, 11, 1), dt.date(2026, 11, 30)).label() == (
            "del 01/11/2026 al 30/11/2026"
        )
        assert DateRange(dt.date(2026, 11, 1)).label() == "desde el 01/11/2026"
        assert DateRange(None, dt.date(2026, 11, 30)).label() == "hasta el 30/11/2026"
        assert DateRange().label() is None and not DateRange().active

    def test_el_dia_empieza_a_las_cero_horas_de_bolivia(self):
        start = day_start(dt.date(2026, 11, 26))
        assert start.utcoffset() == dt.timedelta(hours=-4)
        assert start.astimezone(dt.UTC).hour == 4

    def test_describe_omite_los_vacios(self):
        period = DateRange(dt.date(2026, 1, 1), None)
        assert reports.describe(period, {"Búsqueda": "ana", "Estado": None, "Canal": ""}) == {
            "Fechas": "desde el 01/01/2026",
            "Búsqueda": "ana",
        }
        assert reports.filters_text({}) == "sin filtros"


@requires_db
class TestLimitesDeFechas:
    def test_desde_posterior_a_hasta_se_rechaza(self, client, auth_headers):
        for path in ("/patients", "/inventory", "/inquiries", "/donations", "/users", "/audit"):
            response = client.get(
                f"{API}{path}",
                params={"from": "2026-11-10", "to": "2026-11-01"},
                headers=auth_headers(),
            )
            assert response.status_code == 422, path
            assert "«desde» no puede ser posterior" in response.json()["detail"]

    def test_fecha_de_ingreso_incluye_los_dos_extremos(self, client, auth_headers, db_session):
        days = [dt.date(2025, 3, d) for d in (9, 10, 15, 20, 21)]
        for day in days:
            db_session.add(
                InventoryItem(
                    name=f"Límite {day:%d}",
                    category="otro",
                    quantity=1,
                    condition="bueno",
                    origin="propio",
                    donor_or_institution="",
                    entry_date=day,
                    location="",
                )
            )
        db_session.flush()

        response = client.get(
            f"{API}/inventory",
            params={"from": "2025-03-10", "to": "2025-03-20", "search": "Límite", "limit": 50},
            headers=auth_headers("coordination"),
        )

        names = {item["name"] for item in response.json()["items"]}
        assert names == {"Límite 10", "Límite 15", "Límite 20"}

    def test_fecha_con_hora_se_corta_en_hora_de_bolivia(self, client, auth_headers, db_session):
        bolivia = clock.BOLIVIA
        moments = {
            # 23:59 del día anterior: queda fuera
            "Antes Límite": dt.datetime(2025, 4, 9, 23, 59, tzinfo=bolivia),
            # 00:00 del primer día y 23:59 del último: entran
            "Primero Límite": dt.datetime(2025, 4, 10, 0, 0, tzinfo=bolivia),
            # 21:30 en Bolivia ya es el día siguiente en UTC: igual entra
            "Noche Límite": dt.datetime(2025, 4, 20, 21, 30, tzinfo=bolivia),
            "Último Límite": dt.datetime(2025, 4, 20, 23, 59, tzinfo=bolivia),
            # 00:00 del día siguiente: queda fuera
            "Después Límite": dt.datetime(2025, 4, 21, 0, 0, tzinfo=bolivia),
        }
        for name, moment in moments.items():
            db_session.add(Patient(name=name, ci=str(next(_ci)), phone="70000000"))
            db_session.flush()
            patient = db_session.scalar(select(Patient).where(Patient.name == name))
            patient.created_at = moment
        db_session.flush()

        response = client.get(
            f"{API}/patients",
            params={"from": "2025-04-10", "to": "2025-04-20", "search": "Límite", "limit": 50},
            headers=auth_headers("reception"),
        )

        names = {item["name"] for item in response.json()["items"]}
        assert names == {"Primero Límite", "Noche Límite", "Último Límite"}

    def test_solo_desde_o_solo_hasta(self, client, auth_headers, db_session):
        for day in (dt.date(2024, 1, 5), dt.date(2024, 6, 5)):
            db_session.add(
                InventoryItem(
                    name=f"Abierto {day:%m}",
                    category="otro",
                    quantity=1,
                    condition="bueno",
                    origin="propio",
                    donor_or_institution="",
                    entry_date=day,
                    location="",
                )
            )
        db_session.flush()
        headers = auth_headers("coordination")
        common = {"search": "Abierto", "limit": 50}

        since = client.get(
            f"{API}/inventory", params={**common, "from": "2024-03-01"}, headers=headers
        )
        until = client.get(
            f"{API}/inventory", params={**common, "to": "2024-03-01"}, headers=headers
        )

        assert [i["name"] for i in since.json()["items"]] == ["Abierto 06"]
        assert [i["name"] for i in until.json()["items"]] == ["Abierto 01"]


# ---------------------------------------------------------------------------
# Filas exportadas = filas filtradas, en cada pantalla
# ---------------------------------------------------------------------------
TODAY = clock.today()
YEAR = {"from": f"{TODAY.year - 1}-01-01", "to": TODAY.isoformat()}

# (pantalla, listado, descarga, rol, filtros)
SCREENS = [
    ("Afiliados", "/patients", "/patients/export", "admin", {"group": "all"}),
    ("Afiliados activos", "/patients", "/patients/export", "reception", {"group": "active"}),
    ("Inventario", "/inventory", "/inventory/export", "coordination", {}),
    ("Inventario donado", "/inventory", "/inventory/export", "admin", {"origin": "donado"}),
    ("Actividades", "/schedules", "/schedules/export", "coordination", YEAR),
    ("Donaciones", "/donations", "/donations/export", "reception", {}),
    ("Solicitudes", "/inquiries", "/inquiries/export", "coordination", {}),
    ("Equipo", "/users", "/users/export", "admin", {}),
    ("Registro de actividad", "/audit", "/audit/export", "admin", {"days": 30}),
]


@requires_db
class TestDescargaCompleta:
    @pytest.mark.parametrize(("screen", "listing", "export", "role", "filters"), SCREENS)
    def test_trae_todas_las_filas_del_filtro_y_ninguna_mas(
        self, client, auth_headers, screen, listing, export, role, filters
    ):
        headers = auth_headers(role)
        expected = total(client, headers, listing, **filters)

        response = client.get(
            f"{API}{export}", params={**filters, "format": "csv"}, headers=headers
        )

        if export == "/inventory/export":
            # Dos bloques (Alcaldía y el resto), cada uno con título y encabezados
            rows = list(
                csv.reader(io.StringIO(response.content.decode("utf-8-sig")), delimiter=";")
            )
            data = [r for r in rows if len(r) > 1 and r[0] != "Código"]
            assert len(data) == expected, screen
        else:
            assert len(csv_rows(response)) == expected, screen
        assert response.headers["x-report-rows"] == str(expected)

    def test_la_pagina_no_limita_la_descarga(self, client, auth_headers, db_session):
        for n in range(7):
            db_session.add(Patient(name=f"Página {n}", ci=str(next(_ci)), phone="70000000"))
        db_session.flush()
        headers = auth_headers()
        filters = {"search": "Página", "group": "all"}

        page = client.get(f"{API}/patients", params={**filters, "limit": 3}, headers=headers)
        rows = csv_rows(
            client.get(
                f"{API}/patients/export", params={**filters, "format": "csv"}, headers=headers
            )
        )

        assert len(page.json()["items"]) == 3
        assert sorted(row[0] for row in rows) == [f"Página {n}" for n in range(7)]

    def test_no_trae_filas_de_fuera_del_filtro(self, client, auth_headers, db_session):
        db_session.add(
            Patient(
                name="Baja Reporte",
                ci=str(next(_ci)),
                phone="70000000",
                deleted_at=clock.now(),
                deactivation_reason="Se mudó",
            )
        )
        db_session.flush()
        headers = auth_headers()
        inactive = csv_rows(
            client.get(
                f"{API}/patients/export",
                params={"group": "inactive", "format": "csv"},
                headers=headers,
            )
        )
        assert inactive and all(row[10] == "Inactiva" for row in inactive)
        active = csv_rows(
            client.get(
                f"{API}/patients/export",
                params={"group": "active", "format": "csv"},
                headers=headers,
            )
        )
        assert all(row[10] == "Activa" for row in active)

    def test_excel_con_la_misma_cantidad(self, client, auth_headers):
        headers = auth_headers("coordination")
        expected = total(client, headers, "/inquiries")

        response = client.get(f"{API}/inquiries/export", headers=headers)

        sheet = load_workbook(io.BytesIO(response.content))["Solicitudes"]
        assert sheet.max_row - 1 == expected
        assert sheet["A1"].value == "Recibida" and sheet["A1"].font.bold

    def test_galeria_y_asistencia(self, client, auth_headers):
        headers = auth_headers("coordination")
        albums = client.get(f"{API}/media/albums", params=YEAR, headers=headers).json()
        rows = csv_rows(
            client.get(
                f"{API}/media/albums/export", params={**YEAR, "format": "csv"}, headers=headers
            )
        )
        assert len(rows) == len(albums)

        response = client.get(
            f"{API}/attendance/export", params={**YEAR, "format": "csv"}, headers=headers
        )
        marks = csv_rows(response)
        assert response.headers["x-report-rows"] == str(len(marks))
        assert all(row[5] in {"Vino", "No vino"} for row in marks)
        # La asistencia siempre se pide por rango
        without = client.get(f"{API}/attendance/export", headers=headers)
        assert without.status_code == 422

    def test_sobre_el_tope_pide_acotar(self, client, auth_headers, monkeypatch):
        monkeypatch.setattr(reports, "EXPORT_LIMIT", 1)

        response = client.get(
            f"{API}/patients/export", params={"group": "all"}, headers=auth_headers()
        )

        assert response.status_code == 422
        assert "Acota el rango de fechas" in response.json()["detail"]

    def test_los_textos_no_se_ejecutan_como_formula(self, client, auth_headers, db_session):
        db_session.add(Patient(name="=HYPERLINK(1)", ci=str(next(_ci)), phone="70000000"))
        db_session.flush()

        rows = csv_rows(
            client.get(
                f"{API}/patients/export",
                params={"search": "HYPERLINK", "group": "all", "format": "csv"},
                headers=auth_headers(),
            )
        )

        assert rows[0][0] == "'=HYPERLINK(1)"


# ---------------------------------------------------------------------------
# Seguridad: quién puede descargar
# ---------------------------------------------------------------------------
@requires_db
class TestPermisos:
    @pytest.mark.parametrize(
        ("role", "path"),
        [
            # Ven el listado pero su rol no descarga (sin reports:export)
            ("volunteer", "/patients/export"),
            ("professional", "/patients/export"),
            ("volunteer", "/attendance/export?from=2026-01-01&to=2026-12-31"),
            ("volunteer", "/attendance/monthly?format=csv"),
            # Sin el permiso de la pantalla
            ("reception", "/inventory/export"),
            ("coordination", "/users/export"),
            ("coordination", "/audit/export"),
        ],
    )
    def test_rechaza_sin_permiso(self, client, auth_headers, role, path):
        assert client.get(f"{API}{path}", headers=auth_headers(role)).status_code == 403

    def test_administracion_asigna_el_permiso_por_rol(self, client, auth_headers):
        roles = client.get(f"{API}/roles", headers=auth_headers()).json()
        permission = next(p for p in roles["permissions"] if p["key"] == "reports:export")
        assert permission["isSensitive"] is True
        by_role = {r["key"]: set(r["permissions"]) for r in roles["roles"]}
        assert "reports:export" in by_role["coordination"]
        assert "reports:export" in by_role["reception"]
        assert "reports:export" not in by_role["volunteer"]
        assert "reports:export" not in by_role["professional"]

    def test_la_descarga_no_trae_datos_clinicos(self, client, auth_headers):
        response = client.get(
            f"{API}/patients/export",
            params={"group": "all", "format": "csv"},
            headers=auth_headers(),
        )
        header = response.content.decode("utf-8-sig").splitlines()[0]
        for clinical in ("Diagnóstico", "Medicación", "Síntomas", "Etapa"):
            assert clinical not in header


# ---------------------------------------------------------------------------
# Registro: qué filtro se usó y cuántas filas salieron
# ---------------------------------------------------------------------------
@requires_db
class TestRegistro:
    def test_cada_descarga_queda_en_el_registro_con_filtro_y_filas(
        self, client, auth_headers, db_session
    ):
        headers = auth_headers("coordination")
        expected = total(client, headers, "/inventory", origin="donado", **YEAR)

        client.get(
            f"{API}/inventory/export",
            params={"origin": "donado", **YEAR, "format": "xlsx"},
            headers=headers,
        )

        entry = db_session.scalar(
            select(AuditLog)
            .where(AuditLog.action == "Descarga de reporte", AuditLog.category == "INVENTARIO")
            .order_by(AuditLog.date.desc())
        )
        assert entry.detail.startswith(f"Inventario: {expected} filas en XLSX")
        assert "Origen: Donado" in entry.detail
        assert f"Fechas: del 01/01/{TODAY.year - 1}" in entry.detail
        assert entry.actor == "coordinacion@aspar.org" or entry.actor_role == "Coordinación"

    def test_el_log_guarda_filtros_y_filas(self, client, auth_headers, caplog):
        headers = auth_headers("reception")
        with caplog.at_level(logging.INFO, logger="aspar.reports"):
            listed = client.get(
                f"{API}/donations", params={"status": "confirmado", "limit": 2}, headers=headers
            ).json()
            client.get(
                f"{API}/donations/export",
                params={"status": "confirmado", "format": "csv"},
                headers=headers,
            )

        query, download = [r for r in caplog.records if r.name == "aspar.reports"][-2:]
        assert query.report_screen == "Donaciones"
        assert query.report_filters == {"Estado": "Confirmado"}
        assert query.report_rows == listed["total"]
        assert download.report_rows == listed["total"] and download.report_format == "csv"

    def test_un_listado_sin_filtros_no_llena_el_log(self, client, auth_headers, caplog):
        with caplog.at_level(logging.INFO, logger="aspar.reports"):
            client.get(f"{API}/inquiries", headers=auth_headers("coordination"))
        assert not [r for r in caplog.records if r.name == "aspar.reports"]
