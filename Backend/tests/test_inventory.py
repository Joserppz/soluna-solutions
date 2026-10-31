"""Inventario SRS v2.0 (diseño pág. 11): materiales, movimientos, bajas y exportación."""

import csv
import io

import pytest
from openpyxl import load_workbook
from sqlalchemy import select

from app.models import AuditLog, InventoryMovement
from tests.conftest import requires_db

pytestmark = requires_db

URL = "/api/v1/inventory"
NEW = {
    "name": "Barras paralelas",
    "category": "fisioterapia",
    "quantity": 2,
    "condition": "nuevo",
    "origin": "donado",
    "donorOrInstitution": "Rotary Club",
}


def create(client, headers, **changes):
    response = client.post(URL, json=NEW | changes, headers=headers)
    assert response.status_code == 201, response.text
    return response.json()


def history(client, headers, item_id):
    return client.get(f"{URL}/{item_id}/movements", headers=headers).json()


def test_listar_con_filtros_y_contadores(client, auth_headers):
    headers = auth_headers("coordination")

    everything = client.get(URL, headers=headers).json()
    municipal = client.get(URL, params={"origin": "alcaldia"}, headers=headers).json()
    damaged = client.get(URL, params={"condition": "dañado"}, headers=headers).json()
    found = client.get(URL, params={"search": "pelotas"}, headers=headers).json()
    summary = client.get(f"{URL}/summary", headers=headers).json()

    assert everything["total"] == 6
    assert [i["name"] for i in everything["items"]] == sorted(
        i["name"] for i in everything["items"]
    )
    assert {i["originLabel"] for i in municipal["items"]} == {"Alcaldía"}
    assert [i["name"] for i in damaged["items"]] == ["Banda elástica"]
    assert [i["name"] for i in found["items"]] == ["Pelotas de terapia 65 cm"]
    assert summary == {"total": 6, "alcaldia": 2, "donado": 2, "propio": 2, "damaged": 1}


def test_registrar_crea_el_movimiento_de_ingreso(client, auth_headers, db_session):
    headers = auth_headers("coordination")
    item = create(client, headers)

    assert item["categoryLabel"] == "Fisioterapia" and item["conditionLabel"] == "Nuevo"
    moves = history(client, headers, item["id"])
    assert [(m["movementType"], m["quantityDelta"]) for m in moves] == [("ingreso", 2)]
    assert moves[0]["userName"] == "René Vargas (demo)"
    assert db_session.scalar(select(AuditLog).where(AuditLog.action == "Registro de material"))


def test_prestamo_y_devolucion_actualizan_la_cantidad(client, auth_headers):
    headers = auth_headers("coordination")
    item = create(client, headers, quantity=12)

    loan = client.post(
        f"{URL}/{item['id']}/movements",
        json={"movementType": "prestamo", "quantity": 2, "counterpart": "Familia Apaza"},
        headers=headers,
    )
    back = client.post(
        f"{URL}/{item['id']}/movements",
        json={"movementType": "devolucion", "quantity": 2, "counterpart": "Familia Apaza"},
        headers=headers,
    )

    assert loan.status_code == 201 and loan.json()["quantityDelta"] == -2
    assert back.json()["quantityDelta"] == 2
    assert client.get(f"{URL}/{item['id']}", headers=headers).json()["quantity"] == 12
    assert [m["movementLabel"] for m in history(client, headers, item["id"])] == [
        "Devolución",
        "Préstamo",
        "Ingreso",
    ]


@pytest.mark.parametrize(
    ("movement", "status", "message"),
    [
        (
            {"movementType": "prestamo", "quantity": 5, "counterpart": "Familia Apaza"},
            409,
            "Solo hay 2",
        ),
        ({"movementType": "prestamo", "quantity": 1}, 422, "a quién"),
        ({"movementType": "ingreso", "quantity": 0}, 422, "cero"),
        ({"movementType": "ingreso", "quantity": -3}, 422, "positivo"),
        ({"movementType": "ajuste", "quantity": -1}, 422, "motivo"),
        ({"movementType": "baja", "quantity": 1}, 422, None),
    ],
)
def test_movimientos_invalidos(client, auth_headers, movement, status, message):
    headers = auth_headers("coordination")
    item = create(client, headers)

    response = client.post(f"{URL}/{item['id']}/movements", json=movement, headers=headers)

    assert response.status_code == status
    if message:
        assert message in response.json()["detail"]


def test_editar_cantidad_exige_motivo_y_queda_como_ajuste(client, auth_headers):
    headers = auth_headers("coordination")
    item = create(client, headers, quantity=12)

    no_reason = client.patch(f"{URL}/{item['id']}", json={"quantity": 10}, headers=headers)
    edited = client.patch(
        f"{URL}/{item['id']}",
        json={"quantity": 10, "condition": "bueno", "reason": "Se perdieron 2 en la mudanza"},
        headers=headers,
    )

    assert no_reason.status_code == 422
    assert edited.json()["quantity"] == 10 and edited.json()["condition"] == "bueno"
    adjust = history(client, headers, item["id"])[0]
    assert (adjust["movementType"], adjust["quantityDelta"]) == ("ajuste", -2)
    assert adjust["reason"] == "Se perdieron 2 en la mudanza"


def test_codigo_unico_y_validaciones(client, auth_headers):
    headers = auth_headers("coordination")

    duplicated = client.post(URL, json=NEW | {"code": "fis-001"}, headers=headers)
    bad_origin = client.post(URL, json=NEW | {"origin": "prestado"}, headers=headers)
    future = client.post(URL, json=NEW | {"entryDate": "2999-01-01"}, headers=headers)

    assert duplicated.status_code == 409
    assert bad_origin.status_code == 422
    assert future.status_code == 422


def test_baja_con_motivo_deja_historial_y_bloquea_cambios(client, auth_headers, db_session):
    headers = auth_headers("coordination")
    item = create(client, headers, quantity=3)

    no_reason = client.post(f"{URL}/{item['id']}/deactivate", json={"reason": ""}, headers=headers)
    retired = client.post(
        f"{URL}/{item['id']}/deactivate", json={"reason": "Se rompió el soporte"}, headers=headers
    )

    assert no_reason.status_code == 422
    body = retired.json()
    assert body["active"] is False and body["quantity"] == 0
    assert body["deactivationReason"] == "Se rompió el soporte"
    assert history(client, headers, item["id"])[0]["quantityDelta"] == -3
    assert (
        client.patch(f"{URL}/{item['id']}", json={"name": "Otro"}, headers=headers).status_code
        == 409
    )
    listed = client.get(URL, headers=headers).json()
    assert item["id"] not in {i["id"] for i in listed["items"]}
    with_inactive = client.get(URL, params={"includeInactive": "true"}, headers=headers).json()
    assert item["id"] in {i["id"] for i in with_inactive["items"]}
    assert db_session.scalars(
        select(InventoryMovement).where(InventoryMovement.movement_type == "baja")
    ).all()


def test_exportar_csv_separando_la_alcaldia(client, auth_headers):
    headers = auth_headers("coordination")
    create(client, headers, name="=CMD()")

    response = client.get(f"{URL}/export", params={"format": "csv"}, headers=headers)

    assert response.status_code == 200
    assert 'filename="inventario-' in response.headers["content-disposition"]
    rows = list(csv.reader(io.StringIO(response.content.decode("utf-8-sig")), delimiter=";"))
    municipal_end = rows.index([])
    municipal, others = rows[:municipal_end], rows[municipal_end + 1 :]
    assert municipal[0] == ["Bienes de la Alcaldía"]
    assert {r[1] for r in municipal[2:]} == {"Colchonetas", "Sillas plegables"}
    assert others[0] == ["Bienes propios y donados"]
    assert "'=CMD()" in {r[1] for r in others[2:] if len(r) > 1}
    assert "Colchonetas" not in {r[1] for r in others[2:] if len(r) > 1}


def test_exportar_excel_con_una_hoja_para_la_alcaldia(client, auth_headers):
    response = client.get(f"{URL}/export", headers=auth_headers("coordination"))

    workbook = load_workbook(io.BytesIO(response.content))
    assert workbook.sheetnames == ["Alcaldía", "Propios y donados"]
    municipal = workbook["Alcaldía"]
    assert municipal["A1"].value == "Código" and municipal["A1"].font.bold
    assert {row[1].value for row in municipal.iter_rows(min_row=2)} == {
        "Colchonetas",
        "Sillas plegables",
    }


def test_permisos(client, auth_headers):
    assert client.get(URL, headers=auth_headers("volunteer")).status_code == 403
    assert client.get(URL, headers=auth_headers("reception")).status_code == 403
    assert client.get(URL, headers=auth_headers()).status_code == 200
