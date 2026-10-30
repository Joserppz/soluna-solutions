from sqlalchemy import select

from app.models import AuditLog, User, UserSession
from tests.conftest import requires_db

pytestmark = requires_db

NEW_USER = {
    "name": "Lic. Paola Vargas",
    "email": "Paola.Vargas@aspar.org",
    "role": "professional",
    "department": "Fonoaudiología",
}


def user_id(db_session, email: str) -> str:
    return str(db_session.scalar(select(User.id).where(User.email == email)))


def test_listar_usuarios_con_roles_y_cuentas_pendientes(client, auth_headers):
    response = client.get("/api/v1/users", headers=auth_headers())

    assert response.status_code == 200
    users = response.json()
    assert len(users) == 6
    assert set(users[0]) == {
        "id",
        "name",
        "email",
        "role",
        "roleName",
        "department",
        "active",
        "emailVerified",
        "mustChangePassword",
        "lastLoginAt",
        "createdAt",
    }
    pending = next(u for u in users if u["email"] == "pendiente@aspar.org")
    assert pending["role"] is None
    assert pending["roleName"] == "Pendiente de aprobación"
    assert "passwordHash" not in users[0] and "googleSub" not in users[0]


def test_solo_administracion_gestiona_usuarios(client, auth_headers):
    for role in ("coordination", "professional", "reception", "volunteer", None):
        headers = auth_headers(role)
        assert client.get("/api/v1/users", headers=headers).status_code == 403, role
        assert client.post("/api/v1/users", json=NEW_USER, headers=headers).status_code == 403


def test_crear_usuario_con_contrasena_temporal_que_permite_iniciar_sesion(
    client, auth_headers, db_session
):
    response = client.post("/api/v1/users", json=NEW_USER, headers=auth_headers())

    assert response.status_code == 201
    body = response.json()
    assert body["email"] == "paola.vargas@aspar.org"
    assert body["roleName"] == "Profesional"
    assert body["temporaryPassword"]
    login = client.post(
        "/api/v1/auth/login",
        json={"email": "paola.vargas@aspar.org", "password": body["temporaryPassword"]},
    )
    assert login.status_code == 200
    assert login.json()["user"]["role"] == "professional"
    assert db_session.scalar(select(AuditLog).where(AuditLog.action == "Creación de usuario"))


def test_crear_usuario_con_contrasena_propia(client, auth_headers):
    response = client.post(
        "/api/v1/users", json=NEW_USER | {"password": "Fono2026x"}, headers=auth_headers()
    )

    assert response.status_code == 201
    assert response.json()["temporaryPassword"] is None


def test_validaciones_de_usuario(client, auth_headers):
    headers = auth_headers()
    cases = [
        ({"email": "admin@aspar.org"}, 409, "Ya existe"),
        ({"email": "sin-arroba"}, 422, "correo"),
        ({"role": "director"}, 422, "Rol inválido"),
        ({"name": "Al"}, 422, "3 caracteres"),
        ({"password": "corta1"}, 422, "8 caracteres"),
        ({"password": "solamenteletras"}, 422, "letras y números"),
        ({"name": "x" * 121}, 422, "name"),
    ]
    for override, code, message in cases:
        response = client.post("/api/v1/users", json=NEW_USER | override, headers=headers)
        assert response.status_code == code, override
        assert message in response.json()["detail"], override


def test_asignar_rol_a_cuenta_pendiente(client, auth_headers, db_session):
    pending = user_id(db_session, "pendiente@aspar.org")

    response = client.patch(
        f"/api/v1/users/{pending}", json={"role": "volunteer"}, headers=auth_headers()
    )

    assert response.status_code == 200
    assert response.json()["roleName"] == "Voluntariado"


def test_cambiar_rol_cierra_las_sesiones_del_usuario(client, auth_headers, db_session):
    volunteer_headers = auth_headers("volunteer")
    volunteer = user_id(db_session, "voluntario@aspar.org")

    response = client.patch(
        f"/api/v1/users/{volunteer}",
        json={"role": "reception", "department": "Admisión"},
        headers=auth_headers(),
    )

    assert response.status_code == 200
    assert response.json()["role"] == "reception"
    assert client.get("/api/v1/auth/verify", headers=volunteer_headers).status_code == 401
    assert (
        db_session.scalar(
            select(UserSession).where(
                UserSession.user_id == volunteer, UserSession.revoked_at.is_(None)
            )
        )
        is None
    )


def test_desactivar_usuario_es_critico_y_bloquea_el_login(client, auth_headers, db_session):
    reception = user_id(db_session, "recepcion@aspar.org")

    response = client.patch(
        f"/api/v1/users/{reception}", json={"active": False}, headers=auth_headers()
    )

    assert response.json()["active"] is False
    login = client.post(
        "/api/v1/auth/login", json={"email": "recepcion@aspar.org", "password": "Recep2026!"}
    )
    assert login.status_code == 401
    entry = db_session.scalar(
        select(AuditLog).where(AuditLog.action == "Actualización de usuario y rol")
    )
    assert entry.severity == "CRITICAL"


def test_administracion_no_puede_quitarse_su_propio_rol_ni_desactivarse(
    client, auth_headers, db_session
):
    admin = user_id(db_session, "admin@aspar.org")
    headers = auth_headers()

    assert (
        client.patch(
            f"/api/v1/users/{admin}", json={"role": "coordination"}, headers=headers
        ).status_code
        == 409
    )
    assert (
        client.patch(f"/api/v1/users/{admin}", json={"active": False}, headers=headers).status_code
        == 409
    )


def test_otra_cuenta_de_administracion_se_puede_desactivar(client, auth_headers):
    headers = auth_headers()
    second = client.post(
        "/api/v1/users",
        json=NEW_USER | {"email": "segunda.admin@aspar.org", "role": "admin"},
        headers=headers,
    ).json()

    response = client.patch(
        f"/api/v1/users/{second['id']}", json={"active": False}, headers=headers
    )

    assert response.status_code == 200


def test_restablecer_contrasena(client, auth_headers, db_session):
    coordination = user_id(db_session, "coordinacion@aspar.org")

    response = client.post(
        f"/api/v1/users/{coordination}/reset-password", json={}, headers=auth_headers()
    )

    temporary = response.json()["temporaryPassword"]
    assert response.status_code == 200
    old_login = client.post(
        "/api/v1/auth/login", json={"email": "coordinacion@aspar.org", "password": "Coord2026!"}
    )
    assert old_login.status_code == 401
    new_login = client.post(
        "/api/v1/auth/login", json={"email": "coordinacion@aspar.org", "password": temporary}
    )
    assert new_login.status_code == 200


def test_usuario_inexistente_es_404_y_id_invalido_es_422(client, auth_headers):
    headers = auth_headers()
    missing = "00000000-0000-0000-0000-000000000000"

    assert client.patch(f"/api/v1/users/{missing}", json={}, headers=headers).status_code == 404
    assert client.patch("/api/v1/users/u-x", json={}, headers=headers).status_code == 422
