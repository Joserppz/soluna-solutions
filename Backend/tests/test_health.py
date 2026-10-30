from tests.conftest import requires_db


def test_health_liviano_no_necesita_base_de_datos():
    from fastapi.testclient import TestClient

    from app.main import app

    response = TestClient(app).get("/api/v1/health")

    assert response.status_code == 200
    assert response.json() == {"status": "ok", "service": "ASPAR API"}
    assert response.headers["X-Request-ID"]


@requires_db
def test_health_db_conecta_con_postgresql(client):
    response = client.get("/api/v1/health/db")

    assert response.status_code == 200
    assert response.json()["database"] == "postgresql"
