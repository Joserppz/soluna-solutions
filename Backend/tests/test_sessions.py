from datetime import UTC, datetime, timedelta

import jwt

from app.core import security
from app.models import UserSession
from tests.conftest import requires_db

pytestmark = requires_db


def auth_header(token):
    return {"Authorization": f"Bearer {token}"}


def login(client):
    response = client.post(
        "/api/v1/auth/login", json={"email": "dayana.rojas@ucb.edu.bo", "password": "Admin123"}
    )
    token = response.json()["access_token"]
    return token, jwt.decode(token, options={"verify_signature": False})["sid"]


def test_peticion_autenticada_actualiza_la_ultima_actividad(client, db_session):
    token, sid = login(client)
    session = db_session.get(UserSession, sid)
    session.last_activity_at = datetime.now(UTC) - timedelta(minutes=10)
    db_session.commit()

    assert client.get("/api/v1/auth/verify", headers=auth_header(token)).status_code == 200
    db_session.refresh(session)
    assert datetime.now(UTC) - session.last_activity_at < timedelta(minutes=1)


def test_sesion_inactiva_15_minutos_expira_y_se_revoca(client, db_session):
    token, sid = login(client)
    session = db_session.get(UserSession, sid)
    session.last_activity_at = datetime.now(UTC) - timedelta(minutes=15, seconds=1)
    db_session.commit()

    response = client.get("/api/v1/auth/verify", headers=auth_header(token))

    assert response.status_code == 401
    assert "inactividad" in response.json()["detail"]
    db_session.refresh(session)
    assert session.revoked_at is not None


def test_sesion_vencida_por_tiempo_maximo_es_rechazada(client, db_session):
    token, sid = login(client)
    db_session.get(UserSession, sid).expires_at = datetime.now(UTC) - timedelta(seconds=1)
    db_session.commit()

    assert client.get("/api/v1/auth/verify", headers=auth_header(token)).status_code == 401


def test_refresh_extiende_la_sesion_y_entrega_token_nuevo(client, db_session):
    token, sid = login(client)
    session = db_session.get(UserSession, sid)
    session.expires_at = datetime.now(UTC) + timedelta(minutes=1)
    db_session.commit()

    response = client.post("/api/v1/auth/refresh", headers=auth_header(token))

    assert response.status_code == 200
    body = response.json()
    assert set(body) == {"access_token", "token_type", "expires_in"}
    db_session.refresh(session)
    assert session.refresh_count == 1
    assert session.expires_at > datetime.now(UTC) + timedelta(minutes=29)
    new_payload = security.decode_access_token(body["access_token"])
    assert new_payload["sid"] == sid


def test_logout_revoca_la_sesion(client, db_session):
    token, sid = login(client)

    response = client.post("/api/v1/auth/logout", headers=auth_header(token))

    assert response.json() == {"message": "Sesión cerrada correctamente"}
    assert db_session.get(UserSession, sid).revoked_at is not None
    assert client.get("/api/v1/auth/verify", headers=auth_header(token)).status_code == 401
    assert client.post("/api/v1/auth/refresh", headers=auth_header(token)).status_code == 401


def test_token_con_sesion_de_otro_usuario_es_rechazado(client):
    _, sid = login(client)
    forged = security.create_access_token(
        user_id="u-vol", session_id=sid, email="voluntario@aspar.org", name="X", role="Voluntario"
    )

    assert client.get("/api/v1/auth/verify", headers=auth_header(forged)).status_code == 401


def test_token_mal_formado_es_rechazado(client):
    response = client.get("/api/v1/auth/verify", headers=auth_header("abc.def.ghi"))

    assert response.status_code == 401
