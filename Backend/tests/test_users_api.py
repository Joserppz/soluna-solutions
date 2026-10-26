from sqlalchemy import select

from app.models import AuditLog, UserSession
from tests.conftest import requires_db

pytestmark = requires_db

NEW_USER = {
    "name": "Lic. Paola Vargas",
    "email": "Paola.Vargas@aspar.org",
    "role": "Profesional",
    "department": "Fonoaudiología",
}


def test_listar_usuarios_con_formato_del_frontend(client, auth_headers):
    response = client.get("/api/v1/users", headers=auth_headers())

    assert response.status_code == 200
    users = response.json()
    assert len(users) == 7
    assert set(users[0]) == {"id", "name", "email", "role", "active", "department", "createdAt"}
    assert "passwordHash" not in users[0] and "password_hash" not in users[0]


def test_solo_administrador_gestiona_usuarios(client, auth_headers):
    for role in ("Coordinador", "Profesional", "Recepción", "Voluntario"):
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
    assert body["temporaryPassword"]
    login = client.post(
        "/api/v1/auth/login",
        json={"email": "paola.vargas@aspar.org", "password": body["temporaryPassword"]},
    )
    assert login.status_code == 200
    assert login.json()["user"]["role"] == "Profesional"
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
        ({"role": "Director"}, 422, "Rol inválido"),
        ({"name": "Al"}, 422, "3 caracteres"),
        ({"password": "corta1"}, 422, "8 caracteres"),
        ({"password": "solamenteletras"}, 422, "letras y números"),
    ]
    for override, code, message in cases:
        response = client.post("/api/v1/users", json=NEW_USER | override, headers=headers)
        assert response.status_code == code, override
        assert message in response.json()["detail"], override


def test_cambiar_rol_cierra_las_sesiones_del_usuario(client, auth_headers, db_session):
    volunteer_headers = auth_headers("Voluntario")

    response = client.patch(
        "/api/v1/users/u-vol",
        json={"role": "Recepción", "department": "Admisión"},
        headers=auth_headers(),
    )

    assert response.status_code == 200
    assert response.json()["role"] == "Recepción"
    assert client.get("/api/v1/auth/verify", headers=volunteer_headers).status_code == 401
    assert (
        db_session.scalar(
            select(UserSession).where(
                UserSession.user_id == "u-vol", UserSession.revoked_at.is_(None)
            )
        )
        is None
    )


def test_desactivar_usuario_es_critico_y_bloquea_el_login(client, auth_headers, db_session):
    response = client.patch("/api/v1/users/u-recep", json={"active": False}, headers=auth_headers())

    assert response.json()["active"] is False
    login = client.post(
        "/api/v1/auth/login", json={"email": "recepcion@aspar.org", "password": "Recep2026!"}
    )
    assert login.status_code == 401
    entry = db_session.scalar(
        select(AuditLog).where(AuditLog.action == "Actualización de usuario y rol")
    )
    assert entry.severity == "CRITICAL"


def test_administrador_no_puede_quitarse_su_propio_rol(client, auth_headers):
    response = client.patch(
        "/api/v1/users/u-dayana", json={"role": "Coordinador"}, headers=auth_headers()
    )

    assert response.status_code == 409


def test_debe_quedar_al_menos_un_administrador(client, auth_headers):
    headers = auth_headers()
    for user_id in ("u-admin", "u-jose"):
        assert (
            client.patch(
                f"/api/v1/users/{user_id}", json={"active": False}, headers=headers
            ).status_code
            == 200
        )

    assert (
        client.patch("/api/v1/users/u-dayana", json={"active": False}, headers=headers).status_code
        == 409
    )


def test_restablecer_contrasena(client, auth_headers):
    response = client.post("/api/v1/users/u-coord/reset-password", json={}, headers=auth_headers())

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


def test_usuario_inexistente_es_404(client, auth_headers):
    assert client.patch("/api/v1/users/u-x", json={}, headers=auth_headers()).status_code == 404
