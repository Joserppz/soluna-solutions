from sqlalchemy import select

from app.models import AuditLog, UserSession
from tests.conftest import requires_db

pytestmark = requires_db


def login(client, email="dayana.rojas@ucb.edu.bo", password="Admin123"):
    return client.post("/api/v1/auth/login", json={"email": email, "password": password})


def test_login_correcto_devuelve_token_y_usuario(client, db_session):
    response = login(client)

    assert response.status_code == 200
    body = response.json()
    assert body["token_type"] == "bearer"
    assert body["expires_in"] == 1800
    assert body["idle_timeout"] == 900
    assert body["user"] == {
        "id": "u-dayana",
        "name": "Dayana Gretel Rojas Valencia",
        "email": "dayana.rojas@ucb.edu.bo",
        "role": "Administrador",
        "department": "Soluna Solutions - Arquitectura y Backend",
        "active": True,
    }
    assert db_session.scalar(select(UserSession).where(UserSession.user_id == "u-dayana"))


def test_login_registra_auditoria(client, db_session):
    login(client, "jose.rodriguez.p@ucb.edu.bo")

    entry = db_session.scalar(
        select(AuditLog).where(AuditLog.actor == "jose.rodriguez.p@ucb.edu.bo")
    )
    assert entry.category == "AUTENTICACION"
    assert entry.severity == "INFO"


def test_verify_con_token_valido(client):
    token = login(client).json()["access_token"]

    response = client.get("/api/v1/auth/verify", headers={"Authorization": f"Bearer {token}"})

    assert response.status_code == 200
    assert response.json()["user"]["role"] == "Administrador"


def test_verify_sin_token_es_401(client):
    assert client.get("/api/v1/auth/verify").status_code == 401
