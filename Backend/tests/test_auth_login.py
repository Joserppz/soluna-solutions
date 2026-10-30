from sqlalchemy import select

from app.models import AuditLog, User, UserSession
from tests.conftest import demo_credentials, requires_db

pytestmark = requires_db


def login(client, role="admin"):
    email, password = demo_credentials(role)
    return client.post("/api/v1/auth/login", json={"email": email, "password": password})


def test_login_correcto_devuelve_token_y_usuario(client, db_session):
    response = login(client)

    assert response.status_code == 200
    body = response.json()
    assert body["token_type"] == "bearer"
    assert body["expires_in"] == 1800
    assert body["idle_timeout"] == 900
    admin = db_session.scalar(select(User).where(User.email == "admin@aspar.org"))
    assert body["user"] == {
        "id": str(admin.id),
        "name": admin.name,
        "email": "admin@aspar.org",
        "role": "admin",
        "role_name": "Administración",
        "department": "General",
        "active": True,
    }
    assert db_session.scalar(select(UserSession).where(UserSession.user_id == admin.id))


def test_cuenta_pendiente_inicia_sesion_sin_rol(client):
    response = login(client, role=None)

    assert response.status_code == 200
    assert response.json()["user"]["role"] is None
    assert response.json()["user"]["role_name"] == "Pendiente de aprobación"


def test_login_registra_auditoria(client, db_session):
    login(client, "coordination")

    entry = db_session.scalar(select(AuditLog).where(AuditLog.actor == "coordinacion@aspar.org"))
    assert entry.category == "AUTENTICACION"
    assert entry.severity == "INFO"
    assert entry.actor_role == "Coordinación"


def test_verify_con_token_valido(client):
    token = login(client).json()["access_token"]

    response = client.get("/api/v1/auth/verify", headers={"Authorization": f"Bearer {token}"})

    assert response.status_code == 200
    assert response.json()["user"]["role"] == "admin"


def test_verify_sin_token_es_401(client):
    assert client.get("/api/v1/auth/verify").status_code == 401
