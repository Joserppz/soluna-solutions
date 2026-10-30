import uuid
from datetime import UTC, datetime, timedelta

import jwt

from app.core import security
from app.models import UserSession
from tests.conftest import login, requires_db, session_headers

pytestmark = requires_db


def start(client):
    response = login(client)
    sid = uuid.UUID(
        jwt.decode(response.cookies["aspar_session"], options={"verify_signature": False})["sid"]
    )
    return session_headers(client, response), sid


def me(client, headers):
    return client.get("/api/v1/auth/me", headers=headers)


def test_peticion_autenticada_actualiza_la_ultima_actividad(client, db_session):
    headers, sid = start(client)
    session = db_session.get(UserSession, sid)
    session.last_activity_at = datetime.now(UTC) - timedelta(minutes=10)
    db_session.commit()

    assert me(client, headers).status_code == 200
    db_session.refresh(session)
    assert datetime.now(UTC) - session.last_activity_at < timedelta(minutes=1)


def test_sesion_inactiva_15_minutos_expira_y_se_revoca(client, db_session):
    headers, sid = start(client)
    session = db_session.get(UserSession, sid)
    session.last_activity_at = datetime.now(UTC) - timedelta(minutes=15, seconds=1)
    db_session.commit()

    response = me(client, headers)

    assert response.status_code == 401
    assert "inactividad" in response.json()["detail"]
    db_session.refresh(session)
    assert session.revoked_at is not None


def test_sesion_vencida_en_la_base_es_rechazada(client, db_session):
    headers, sid = start(client)
    db_session.get(UserSession, sid).expires_at = datetime.now(UTC) - timedelta(seconds=1)
    db_session.commit()

    assert me(client, headers).status_code == 401


def test_refresh_extiende_la_sesion_y_entrega_cookies_nuevas(client, db_session):
    headers, sid = start(client)
    session = db_session.get(UserSession, sid)
    session.expires_at = datetime.now(UTC) + timedelta(minutes=1)
    db_session.commit()

    response = client.post("/api/v1/auth/refresh", headers=headers)

    assert response.status_code == 200
    assert response.json()["expiresIn"] > 29 * 60
    db_session.refresh(session)
    assert session.refresh_count == 1
    assert session.expires_at > datetime.now(UTC) + timedelta(minutes=29)
    new_payload = security.decode_access_token(response.cookies["aspar_session"])
    assert new_payload["sid"] == str(sid)
    assert new_payload["exp"] == int(session.expires_at.timestamp())


def test_refresh_nunca_supera_el_tope_absoluto_de_8_horas(client, db_session):
    headers, sid = start(client)
    session = db_session.get(UserSession, sid)
    session.expires_at = datetime.now(UTC) + timedelta(minutes=1)
    session.absolute_expires_at = datetime.now(UTC) + timedelta(minutes=5)
    db_session.commit()

    body = client.post("/api/v1/auth/refresh", headers=headers).json()

    db_session.refresh(session)
    assert session.expires_at == session.absolute_expires_at
    assert body["expiresIn"] <= 300


def test_sesion_pasado_el_tope_absoluto_es_rechazada(client, db_session):
    headers, sid = start(client)
    session = db_session.get(UserSession, sid)
    session.absolute_expires_at = session.expires_at = datetime.now(UTC) - timedelta(seconds=1)
    db_session.commit()

    assert me(client, headers).status_code == 401


def test_logout_revoca_la_sesion_y_borra_las_cookies(client, db_session):
    headers, sid = start(client)

    response = client.post("/api/v1/auth/logout", headers=headers)

    assert response.json() == {"message": "Sesión cerrada correctamente"}
    cleared = " ".join(response.headers.get_list("set-cookie"))
    assert 'aspar_session=""' in cleared and 'aspar_csrf=""' in cleared
    assert db_session.get(UserSession, sid).revoked_at is not None
    assert me(client, headers).status_code == 401
    assert client.post("/api/v1/auth/refresh", headers=headers).status_code == 401


def test_token_con_sesion_de_otro_usuario_es_rechazado(client):
    _, sid = start(client)
    forged = security.create_access_token(
        user_id=str(uuid.uuid4()),
        session_id=str(sid),
        expires_at=datetime.now(UTC) + timedelta(minutes=5),
    )

    assert me(client, {"Cookie": f"aspar_session={forged}"}).status_code == 401


def test_token_mal_formado_es_rechazado(client):
    assert me(client, {"Cookie": "aspar_session=abc.def.ghi"}).status_code == 401
