from sqlalchemy import select

from app.models import AuditLog, User, UserSession
from tests.conftest import login, requires_db, session_headers

pytestmark = requires_db


def test_login_correcto_crea_la_sesion_en_cookies(client, db_session):
    response = login(client)

    assert response.status_code == 200
    body = response.json()
    assert set(body) == {"user", "permissions", "expiresIn", "idleTimeout", "csrfToken"}
    assert "accessToken" not in body and "access_token" not in body
    assert 1795 <= body["expiresIn"] <= 1800
    assert body["idleTimeout"] == 900
    admin = db_session.scalar(select(User).where(User.email == "admin@aspar.org"))
    assert body["user"] == {
        "id": str(admin.id),
        "name": admin.name,
        "email": "admin@aspar.org",
        "role": "admin",
        "roleName": "Administración",
        "department": "General",
        "active": True,
        "emailVerified": True,
        "mustChangePassword": False,
        "hasPassword": True,
        "googleLinked": False,
    }
    assert db_session.scalar(select(UserSession).where(UserSession.user_id == admin.id))


def test_cookies_httponly_secure_y_samesite(client):
    response = login(client)

    cookies = {c.split("=", 1)[0]: c for c in response.headers.get_list("set-cookie")}
    session, csrf = cookies["aspar_session"], cookies["aspar_csrf"]
    assert "HttpOnly" in session and "Secure" in session and "SameSite=lax" in session
    assert "Path=/api" in session
    # El frontend necesita leer el token CSRF: esa cookie no es HttpOnly
    assert "HttpOnly" not in csrf and "Secure" in csrf
    assert response.cookies["aspar_csrf"] == response.json()["csrfToken"]


def test_cuenta_pendiente_inicia_sesion_sin_rol(client):
    response = login(client, role=None)

    assert response.status_code == 200
    assert response.json()["user"]["role"] is None
    assert response.json()["user"]["roleName"] == "Pendiente de aprobación"


def test_login_registra_auditoria(client, db_session):
    login(client, "coordination")

    entry = db_session.scalar(select(AuditLog).where(AuditLog.actor == "coordinacion@aspar.org"))
    assert entry.category == "AUTENTICACION"
    assert entry.severity == "INFO"
    assert entry.actor_role == "Coordinación"


def test_me_devuelve_la_sesion_actual(client):
    headers = session_headers(client, login(client))

    response = client.get("/api/v1/auth/me", headers=headers)

    assert response.status_code == 200
    assert response.json()["user"]["role"] == "admin"
    assert response.json()["csrfToken"] == headers["X-CSRF-Token"]


def test_me_sin_sesion_es_401(client):
    assert client.get("/api/v1/auth/me").status_code == 401


def test_el_token_en_authorization_bearer_ya_no_se_acepta(client):
    token = login(client).cookies["aspar_session"]
    client.cookies.clear()

    response = client.get("/api/v1/auth/me", headers={"Authorization": f"Bearer {token}"})

    assert response.status_code == 401


def test_modificar_datos_sin_token_csrf_es_403(client, patient_ids):
    headers = session_headers(client, login(client))
    without_csrf = {"Cookie": headers["Cookie"]}
    wrong_csrf = without_csrf | {"X-CSRF-Token": "0" * 64}

    for attempt in (without_csrf, wrong_csrf):
        response = client.patch(
            f"/api/v1/patients/{patient_ids['consent']}", json={"zone": "X"}, headers=attempt
        )
        assert response.status_code == 403
        assert "X-CSRF-Token" in response.json()["detail"]
    # Las lecturas no necesitan el token
    assert client.get("/api/v1/auth/me", headers=without_csrf).status_code == 200


def test_peticion_desde_otro_sitio_es_rechazada(client, auth_headers, patient_ids):
    response = client.patch(
        f"/api/v1/patients/{patient_ids['consent']}",
        json={"zone": "X"},
        headers=auth_headers() | {"Origin": "https://sitio-malicioso.com"},
    )
    allowed = client.patch(
        f"/api/v1/patients/{patient_ids['consent']}",
        json={"zone": "Sopocachi"},
        headers=auth_headers() | {"Origin": "http://localhost:5173"},
    )

    assert response.status_code == 403
    assert response.json() == {"detail": "Origen no permitido."}
    assert allowed.status_code == 200
