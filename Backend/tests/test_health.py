from tests.conftest import requires_db


@requires_db
def test_health_conecta_con_postgresql(client):
    response = client.get("/api/v1/health")

    assert response.status_code == 200
    assert response.json()["status"] == "ok"
