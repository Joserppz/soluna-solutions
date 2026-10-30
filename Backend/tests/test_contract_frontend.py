"""Contrato de errores API <-> Frontend (SCRUM-58 / SCRUM-86).

El frontend muestra ``body.detail`` como texto en todos los errores. Desde el Sprint 2
el resto del contrato (campos de cada respuesta) se verifica con los tipos generados
desde docs/api/openapi.json (Bloque 3), no contra Frontend/src/types/aspar.ts, que
corresponde a las pantallas del Sprint 1.
"""

from tests.conftest import requires_db


@requires_db
def test_errores_devuelven_detail_como_texto(client, auth_headers):
    missing = "00000000-0000-0000-0000-000000000000"
    responses = [
        client.post("/api/v1/auth/login", json={"email": "x@y.co", "password": "mala"}),
        client.post("/api/v1/auth/login", json={}),
        client.get("/api/v1/patients"),
        client.get(f"/api/v1/patients/{missing}", headers=auth_headers()),
        client.get("/api/v1/patients/no-es-uuid", headers=auth_headers()),
        client.get("/api/v1/users", headers=auth_headers("volunteer")),
    ]

    for response in responses:
        assert isinstance(response.json()["detail"], str), response.request.url
