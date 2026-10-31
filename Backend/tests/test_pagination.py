"""Paginación estándar de los listados: {items, total, limit, offset}."""

import pytest

from tests.conftest import requires_db

pytestmark = requires_db

LISTS = ("/api/v1/patients", "/api/v1/users", "/api/v1/audit")


@pytest.mark.parametrize("path", LISTS)
def test_listados_responden_con_el_sobre_de_paginacion(client, auth_headers, path):
    body = client.get(path, headers=auth_headers()).json()

    assert set(body) == {"items", "total", "limit", "offset"}
    assert (body["limit"], body["offset"]) == (50, 0)
    assert body["total"] >= len(body["items"]) > 0


@pytest.mark.parametrize("path", LISTS)
def test_limites_fuera_de_rango_son_422(client, auth_headers, path):
    headers = auth_headers()

    for params in ({"limit": 0}, {"limit": 201}, {"offset": -1}):
        assert client.get(path, params=params, headers=headers).status_code == 422, params


def test_las_paginas_no_repiten_ni_saltan_filas(client, auth_headers):
    headers = auth_headers()
    everyone = client.get("/api/v1/users", params={"limit": 200}, headers=headers).json()
    pages = [
        client.get("/api/v1/users", params={"limit": 2, "offset": offset}, headers=headers).json()
        for offset in range(0, everyone["total"], 2)
    ]

    paged_ids = [user["id"] for page in pages for user in page["items"]]
    assert paged_ids == [user["id"] for user in everyone["items"]]
    assert all(page["total"] == everyone["total"] for page in pages)
    assert [len(page["items"]) for page in pages] == [2, 2, 2]


def test_total_cuenta_los_filtros_y_no_solo_la_pagina(client, auth_headers):
    body = client.get(
        "/api/v1/patients", params={"includeInactive": "true", "limit": 1}, headers=auth_headers()
    ).json()

    assert len(body["items"]) == 1
    assert body["total"] >= 3


def test_buscar_en_el_equipo_por_nombre_o_correo(client, auth_headers):
    headers = auth_headers()

    by_email = client.get("/api/v1/users", params={"search": "RECEPCION@"}, headers=headers)
    by_name = client.get("/api/v1/users", params={"search": "rocha"}, headers=headers)
    wildcard = client.get("/api/v1/users", params={"search": "%"}, headers=headers)

    assert [u["email"] for u in by_email.json()["items"]] == ["recepcion@aspar.org"]
    assert [u["role"] for u in by_name.json()["items"]] == [None]
    assert wildcard.json() == {"items": [], "total": 0, "limit": 50, "offset": 0}
