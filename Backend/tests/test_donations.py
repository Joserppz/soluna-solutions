"""Donaciones sin pasarela (diseño págs. 4, 5, 15 y 16): avisos, confirmación, sede y meta."""

from datetime import timedelta

import pytest
from sqlalchemy import select

from app.core import clock
from app.models import AuditLog, Donation, InventoryItem, InventoryMovement
from tests.conftest import requires_db

pytestmark = requires_db

URL = "/api/v1/donations"
PUBLIC = "/api/v1/public/donations"
NOTICE = {"donorName": "Marcela Quispe", "amountBs": 100, "turnstileToken": "humano"}


def goal(client):
    return client.get(f"{PUBLIC}/goal").json()


def pending(db_session, name="Marcela Quispe"):
    return db_session.scalar(
        select(Donation).where(Donation.donor_name == name, Donation.status == "pendiente")
    )


class TestSitioPublico:
    def test_la_meta_suma_solo_lo_confirmado(self, client):
        body = goal(client)

        # 200 (QR confirmado) + 300 (efectivo) + 18.000 de ajuste; los pendientes no suman
        assert body["raisedBs"] == 18500
        assert body["targetBs"] == 60000
        assert body["percent"] == 30
        assert body["confirmedCount"] == 2
        assert [m["status"] for m in body["milestones"]] == ["cubierto", "en_camino", "pendiente"]
        assert "id" not in body and "manualAdjustmentBs" not in body

    def test_avisar_un_aporte_queda_pendiente_y_se_puede_seguir(self, client, captcha, db_session):
        response = client.post(
            f"{PUBLIC}/notice",
            json=NOTICE | {"declaredReference": "48213999", "donorName": "Ana Pérez"},
        )

        assert response.status_code == 201, response.text
        body = response.json()
        assert (body["status"], body["statusLabel"], body["amountBs"]) == (
            "pendiente",
            "Pendiente",
            100,
        )
        assert "donorName" not in body
        tracked = client.get(f"{PUBLIC}/notice/{body['id']}").json()
        assert tracked["status"] == "pendiente"
        saved = db_session.get(Donation, body["id"])
        assert (saved.channel, saved.source, saved.declared_reference) == (
            "qr_bancario",
            "sitio",
            "48213999",
        )
        assert saved.goal_id is not None
        assert goal(client)["raisedBs"] == 18500

    def test_aviso_anonimo_y_validaciones(self, client, captcha):
        anonymous = client.post(
            f"{PUBLIC}/notice", json={"amountBs": 50, "turnstileToken": "humano"}
        )
        robot = client.post(f"{PUBLIC}/notice", json=NOTICE | {"turnstileToken": "robot"})
        zero = client.post(f"{PUBLIC}/notice", json=NOTICE | {"amountBs": 0})
        too_much = client.post(f"{PUBLIC}/notice", json=NOTICE | {"amountBs": 100001})
        cents = client.post(f"{PUBLIC}/notice", json=NOTICE | {"amountBs": 10.555})

        assert anonymous.status_code == 201
        assert robot.status_code == 400
        assert [r.status_code for r in (zero, too_much, cents)] == [422, 422, 422]

    def test_seguimiento_de_un_aporte_que_no_es_un_aviso(self, client, db_session):
        cash = db_session.scalar(select(Donation).where(Donation.channel == "efectivo"))

        assert client.get(f"{PUBLIC}/notice/{cash.id}").status_code == 404

    def test_sin_meta_visible_responde_null(self, client, auth_headers):
        client.put(
            f"{URL}/goal",
            json={"title": "Meta oculta", "targetBs": 1000, "visible": False},
            headers=auth_headers("coordination"),
        )

        response = client.get(f"{PUBLIC}/goal")
        assert response.status_code == 200 and response.json() is None


class TestConfirmarYAnular:
    def test_confirmar_con_el_extracto_suma_a_la_meta(self, client, auth_headers, db_session):
        donation = pending(db_session)

        response = client.post(
            f"{URL}/{donation.id}/confirm",
            json={"bankReference": "48213907", "creditedOn": clock.today().isoformat()},
            headers=auth_headers("coordination"),
        )

        assert response.status_code == 200, response.text
        body = response.json()
        assert (body["status"], body["bankReference"]) == ("confirmado", "48213907")
        assert body["reviewedAt"]
        assert goal(client)["raisedBs"] == 18600
        assert db_session.scalar(
            select(AuditLog).where(AuditLog.action == "Confirmación de aporte")
        )

    def test_la_misma_referencia_no_confirma_dos_aportes(self, client, auth_headers, db_session):
        anonymous = db_session.scalar(
            select(Donation).where(Donation.donor_name.is_(None), Donation.status == "pendiente")
        )

        response = client.post(
            f"{URL}/{anonymous.id}/confirm",
            json={"bankReference": "ext-20261027-0193", "creditedOn": clock.today().isoformat()},
            headers=auth_headers("coordination"),
        )

        assert response.status_code == 409
        assert "ya confirmó otro aporte" in response.json()["detail"]

    @pytest.mark.parametrize(
        ("body", "status"),
        [
            ({"bankReference": "48", "creditedOn": "2026-10-01"}, 422),
            ({"bankReference": "48213907"}, 422),
            ({"bankReference": "48213907", "creditedOn": "FUTURO"}, 422),
        ],
    )
    def test_confirmar_exige_referencia_y_fecha(
        self, client, auth_headers, db_session, body, status
    ):
        if body.get("creditedOn") == "FUTURO":
            body = body | {"creditedOn": (clock.today() + timedelta(days=1)).isoformat()}

        response = client.post(
            f"{URL}/{pending(db_session).id}/confirm",
            json=body,
            headers=auth_headers("coordination"),
        )

        assert response.status_code == status

    def test_anular_exige_motivo_y_queda_en_la_bitacora(self, client, auth_headers, db_session):
        donation = pending(db_session)
        headers = auth_headers("coordination")

        no_reason = client.post(f"{URL}/{donation.id}/cancel", json={"reason": ""}, headers=headers)
        cancelled = client.post(
            f"{URL}/{donation.id}/cancel",
            json={"reason": "No aparece en el extracto"},
            headers=headers,
        )

        assert no_reason.status_code == 422
        assert cancelled.json()["status"] == "anulado"
        assert cancelled.json()["cancellationReason"] == "No aparece en el extracto"
        log = db_session.scalar(
            select(AuditLog).where(AuditLog.action == "Anulación de aviso de aporte")
        )
        assert log.severity == "WARNING" and "No aparece en el extracto" in log.detail

    def test_solo_se_confirma_o_anula_un_aviso_pendiente(self, client, auth_headers, db_session):
        headers = auth_headers("coordination")
        confirmed = db_session.scalar(select(Donation).where(Donation.status == "confirmado"))

        again = client.post(
            f"{URL}/{confirmed.id}/confirm",
            json={"bankReference": "1234", "creditedOn": "2026-10-01"},
            headers=headers,
        )
        cancel_confirmed = client.post(
            f"{URL}/{confirmed.id}/cancel", json={"reason": "Error"}, headers=headers
        )

        assert again.status_code == 409
        assert cancel_confirmed.status_code == 409


class TestAporteEnLaSede:
    def test_efectivo_entra_confirmado_y_suma(self, client, auth_headers):
        response = client.post(
            URL,
            json={
                "channel": "efectivo",
                "donorName": "Familia Apaza",
                "amountBs": 250,
                "receiptNumber": "Recibo 0130",
            },
            headers=auth_headers("reception"),
        )

        assert response.status_code == 201, response.text
        body = response.json()
        assert (body["status"], body["source"], body["declaredReference"]) == (
            "confirmado",
            "sede",
            "Recibo 0130",
        )
        assert goal(client)["raisedBs"] == 18750

    def test_especie_entra_recibido_y_crea_el_material_donado(
        self, client, auth_headers, db_session
    ):
        response = client.post(
            URL,
            json={
                "channel": "especie",
                "donorName": "Grupo de exalumnos del colegio",
                "inKindDescription": "Pelotas de terapia de 55 cm",
                "quantity": 6,
                "condition": "nuevo",
                "category": "fisioterapia",
                "estimatedValueBs": 600,
            },
            headers=auth_headers("reception"),
        )

        assert response.status_code == 201, response.text
        body = response.json()
        assert body["status"] == "recibido" and body["amountBs"] is None
        item = db_session.get(InventoryItem, body["inventoryItemId"])
        assert (item.name, item.quantity, item.condition, item.origin) == (
            "Pelotas de terapia de 55 cm",
            6,
            "nuevo",
            "donado",
        )
        assert item.donor_or_institution == "Grupo de exalumnos del colegio"
        movement = db_session.scalar(
            select(InventoryMovement).where(InventoryMovement.item_id == item.id)
        )
        assert (movement.movement_type, movement.quantity_delta) == ("ingreso", 6)
        assert movement.reason == "Donación en especie"
        # El valor estimado no suma a la meta
        assert goal(client)["raisedBs"] == 18500

    def test_especie_sin_agregar_al_inventario(self, client, auth_headers):
        body = client.post(
            URL,
            json={"channel": "especie", "inKindDescription": "Libros", "addToInventory": False},
            headers=auth_headers("reception"),
        ).json()

        assert body["inventoryItemId"] is None and body["donorName"] is None

    @pytest.mark.parametrize(
        "payload",
        [
            {"channel": "efectivo"},
            {"channel": "especie", "inKindDescription": "x"},
            {"channel": "qr_bancario", "amountBs": 10},
            {"channel": "efectivo", "amountBs": 10, "date": "2999-01-01"},
        ],
    )
    def test_validaciones(self, client, auth_headers, payload):
        assert client.post(URL, json=payload, headers=auth_headers("reception")).status_code == 422


class TestRegistroYMeta:
    def test_listar_buscar_y_filtrar(self, client, auth_headers):
        headers = auth_headers("coordination")

        everything = client.get(URL, headers=headers).json()
        by_reference = client.get(URL, params={"search": "48213907"}, headers=headers).json()
        to_confirm = client.get(URL, params={"status": "pendiente"}, headers=headers).json()

        assert everything["total"] == 6
        assert [d["donorName"] for d in by_reference["items"]] == ["Marcela Quispe"]
        assert to_confirm["total"] == 2
        assert everything["items"][0]["channelLabel"]

    def test_resumen_del_mes(self, client, auth_headers):
        month = clock.today().strftime("%Y-%m")

        body = client.get(f"{URL}/summary", params={"month": month}, headers=auth_headers()).json()

        assert body["month"] == month
        assert (
            body["pendingCount"]
            + body["confirmedCount"]
            + body["inKindCount"]
            + body["cancelledCount"]
            <= 6
        )
        assert body["confirmedBs"] == sum(c["amountBs"] for c in body["byChannel"])

    def test_editar_la_meta_y_sus_hitos(self, client, auth_headers, db_session):
        response = client.put(
            f"{URL}/goal",
            json={
                "title": "Equipos de fisioterapia",
                "targetBs": 20000,
                "manualAdjustmentBs": 0,
                "visible": True,
                "milestones": [{"label": "Colchonetas", "status": "cubierto"}],
            },
            headers=auth_headers("coordination"),
        )

        assert response.status_code == 200, response.text
        assert response.json()["raisedBs"] == 500
        public = goal(client)
        assert (public["title"], public["percent"]) == ("Equipos de fisioterapia", 2)
        assert [m["label"] for m in public["milestones"]] == ["Colchonetas"]
        assert client.get(f"{URL}/goal", headers=auth_headers()).json()["manualAdjustmentBs"] == 0

    def test_permisos(self, client, auth_headers):
        assert client.get(URL, headers=auth_headers("volunteer")).status_code == 403
        assert client.get(URL, headers=auth_headers("professional")).status_code == 403
        assert client.get(URL, headers=auth_headers("reception")).status_code == 200


class TestExportarResumen:
    def test_csv_con_resumen_y_detalle(self, client, auth_headers):
        import csv
        import io

        month = clock.today().strftime("%Y-%m")

        response = client.get(
            f"{URL}/summary", params={"month": month, "format": "csv"}, headers=auth_headers()
        )

        assert response.status_code == 200
        assert response.headers["content-type"].startswith("text/csv")
        assert f'filename="donaciones-{month}.csv"' in response.headers["content-disposition"]
        assert response.content.startswith("﻿".encode())
        rows = list(csv.reader(io.StringIO(response.content.decode("utf-8-sig")), delimiter=";"))
        assert rows[0] == ["Resumen del mes"] and rows[2] == ["Mes", month]
        detail = rows[rows.index(["Aportes del mes"]) + 1 :]
        assert detail[0][:6] == ["Fecha", "Donante", "Canal", "Monto (Bs.)", "En especie", "Estado"]
        donors = {row[1] for row in detail[1:]}
        assert "Anónimo" in donors and "Marcela Quispe" in donors

    def test_excel_con_dos_hojas(self, client, auth_headers):
        import io

        from openpyxl import load_workbook

        response = client.get(f"{URL}/summary", params={"format": "xlsx"}, headers=auth_headers())

        workbook = load_workbook(io.BytesIO(response.content))
        assert workbook.sheetnames == ["Resumen", "Aportes"]
        assert workbook["Aportes"]["A1"].value == "Fecha"
        assert workbook["Resumen"]["A1"].font.bold

    def test_formato_invalido_y_permisos(self, client, auth_headers):
        assert (
            client.get(
                f"{URL}/summary", params={"format": "pdf"}, headers=auth_headers()
            ).status_code
            == 422
        )
        assert (
            client.get(
                f"{URL}/summary", params={"format": "csv"}, headers=auth_headers("volunteer")
            ).status_code
            == 403
        )


class TestReferenciaUnica:
    def test_confirmacion_simultanea_con_la_misma_referencia_es_409(
        self, client, auth_headers, db_session, monkeypatch
    ):
        from app.modules.donations import repository as donation_repository

        anonymous = db_session.scalar(
            select(Donation).where(Donation.donor_name.is_(None), Donation.status == "pendiente")
        )
        # Simula a otra persona: la revisión previa no ve la otra confirmación (aún sin guardar)
        monkeypatch.setattr(donation_repository, "bank_reference_used", lambda *args: False)

        response = client.post(
            f"{URL}/{anonymous.id}/confirm",
            json={"bankReference": "EXT-20261027-0193", "creditedOn": clock.today().isoformat()},
            headers=auth_headers("coordination"),
        )

        assert response.status_code == 409
        assert "ya confirmó otro aporte" in response.json()["detail"]
        db_session.expire_all()
        assert db_session.get(Donation, anonymous.id).status == "pendiente"
        assert goal(client)["raisedBs"] == 18500

    def test_la_base_rechaza_dos_confirmados_con_la_misma_referencia(self, db_session):
        from sqlalchemy.exc import IntegrityError

        anonymous = db_session.scalar(
            select(Donation).where(Donation.donor_name.is_(None), Donation.status == "pendiente")
        )
        with (
            pytest.raises(IntegrityError, match="donations_referencia_extracto_unica"),
            db_session.begin_nested(),
        ):
            anonymous.status = "confirmado"
            anonymous.bank_reference = "ext-20261027-0193"
            anonymous.credited_on = clock.today()
            db_session.flush()

    def test_una_referencia_anulada_no_bloquea(self, client, auth_headers, db_session):
        cancelled = db_session.scalar(select(Donation).where(Donation.status == "anulado"))
        cancelled.bank_reference = "REF-REUSABLE"
        db_session.flush()

        response = client.post(
            f"{URL}/{pending(db_session).id}/confirm",
            json={"bankReference": "REF-REUSABLE", "creditedOn": clock.today().isoformat()},
            headers=auth_headers("coordination"),
        )

        assert response.status_code == 200
