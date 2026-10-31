"""Equipo y permisos (diseño pág. 18): matriz de roles, permisos editables y aprobaciones."""

import pytest
from sqlalchemy import select

from app.models import AuditLog, User
from app.modules.users.models import PERMISSION_KEYS
from tests.conftest import requires_db

pytestmark = requires_db

ROLES = "/api/v1/roles"


def matrix(client, headers):
    response = client.get(ROLES, headers=headers)
    assert response.status_code == 200, response.text
    return response.json()


def role(body, key):
    return next(r for r in body["roles"] if r["key"] == key)


def set_permissions(client, headers, key, permissions, confirm=False):
    return client.put(
        f"{ROLES}/{key}/permissions",
        json={"permissions": permissions, "confirmSensitive": confirm},
        headers=headers,
    )


def test_matriz_de_los_cinco_roles_con_permisos_sensibles_marcados(client, auth_headers):
    body = matrix(client, auth_headers())

    assert [r["key"] for r in body["roles"]][0] == "admin"
    assert {r["key"] for r in body["roles"]} == {
        "admin",
        "coordination",
        "professional",
        "reception",
        "volunteer",
    }
    admin = role(body, "admin")
    assert admin["isSystem"] is True
    assert set(admin["permissions"]) == set(PERMISSION_KEYS)
    assert role(body, "volunteer")["permissions"] == ["attendance:write", "patients:read"]
    assert role(body, "admin")["members"] == 1
    sensitive = {p["key"] for p in body["permissions"] if p["isSensitive"]}
    assert {"patients:read_clinical", "users:manage", "audit:read"} <= sensitive
    assert "patients:read" not in sensitive


def test_solo_quien_gestiona_el_equipo_ve_la_matriz(client, auth_headers):
    assert client.get(ROLES, headers=auth_headers("coordination")).status_code == 403


def test_editar_permisos_de_un_rol_tiene_efecto_inmediato(client, auth_headers, db_session):
    volunteer = auth_headers("volunteer")
    assert client.get("/api/v1/users", headers=volunteer).status_code == 403

    response = set_permissions(
        client,
        auth_headers(),
        "volunteer",
        ["attendance:write", "patients:read", "inventory:manage"],
    )

    assert response.status_code == 200, response.text
    assert response.json()["permissions"] == [
        "attendance:write",
        "inventory:manage",
        "patients:read",
    ]
    me = client.get("/api/v1/auth/me", headers=volunteer).json()
    assert "inventory:manage" in me["permissions"]
    log = db_session.scalar(
        select(AuditLog).where(AuditLog.action == "Cambio de permisos de un rol")
    )
    assert log.severity == "WARNING"
    assert "agregó [inventory:manage]" in log.detail


def test_dar_un_permiso_sensible_exige_confirmacion(client, auth_headers, db_session):
    headers = auth_headers()
    wanted = ["attendance:write", "patients:read", "patients:read_clinical"]

    warning = set_permissions(client, headers, "volunteer", wanted)
    assert warning.status_code == 409
    assert "acceso sensible" in warning.json()["detail"]
    assert "historia clínica" in warning.json()["detail"]
    assert role(matrix(client, headers), "volunteer")["permissions"] == [
        "attendance:write",
        "patients:read",
    ]

    confirmed = set_permissions(client, headers, "volunteer", wanted, confirm=True)
    assert confirmed.status_code == 200
    log = db_session.scalar(
        select(AuditLog).where(AuditLog.action == "Cambio de permisos de un rol")
    )
    assert log.severity == "CRITICAL"


def test_quitar_permisos_no_pide_confirmacion(client, auth_headers):
    response = set_permissions(client, auth_headers(), "professional", ["patients:read"])

    assert response.status_code == 200
    assert response.json()["permissions"] == ["patients:read"]


def test_el_rol_de_administracion_no_se_edita(client, auth_headers):
    response = set_permissions(client, auth_headers(), "admin", ["patients:read"], confirm=True)

    assert response.status_code == 409
    assert "Administración siempre tiene todos los permisos" in response.json()["detail"]
    assert set(role(matrix(client, auth_headers()), "admin")["permissions"]) == set(PERMISSION_KEYS)


@pytest.mark.parametrize(
    ("key", "permissions", "status"),
    [
        ("no-existe", ["patients:read"], 404),
        ("volunteer", ["patients:volar"], 422),
    ],
)
def test_rol_o_permiso_desconocido(client, auth_headers, key, permissions, status):
    assert set_permissions(client, auth_headers(), key, permissions).status_code == status


def test_editar_permisos_exige_roles_manage(client, auth_headers):
    response = set_permissions(client, auth_headers("coordination"), "volunteer", [])

    assert response.status_code == 403


class TestCuentasPendientes:
    def test_listar_solo_las_cuentas_pendientes_y_filtrar_por_rol(self, client, auth_headers):
        headers = auth_headers()

        pending = client.get("/api/v1/users", params={"role": "pendiente"}, headers=headers)
        volunteers = client.get("/api/v1/users", params={"role": "volunteer"}, headers=headers)

        assert [u["email"] for u in pending.json()["items"]] == ["pendiente@aspar.org"]
        assert pending.json()["items"][0]["roleName"] == "Pendiente de aprobación"
        assert [u["email"] for u in volunteers.json()["items"]] == ["voluntario@aspar.org"]

    def test_aprobar_asigna_el_rol_y_da_acceso(self, client, auth_headers, db_session):
        pending_user = auth_headers(None)
        assert client.get("/api/v1/patients", headers=pending_user).status_code == 403
        user_id = db_session.scalar(select(User.id).where(User.email == "pendiente@aspar.org"))

        response = client.post(
            f"/api/v1/users/{user_id}/approve",
            json={"role": "reception", "department": "Recepción"},
            headers=auth_headers(),
        )

        assert response.status_code == 200, response.text
        assert response.json()["role"] == "reception"
        assert response.json()["department"] == "Recepción"
        assert client.get("/api/v1/patients", headers=pending_user).status_code == 200
        assert db_session.scalar(select(AuditLog).where(AuditLog.action == "Aprobación de cuenta"))

    def test_no_se_aprueba_dos_veces_ni_sin_correo_confirmado(
        self, client, auth_headers, db_session
    ):
        headers = auth_headers()
        volunteer_id = db_session.scalar(
            select(User.id).where(User.email == "voluntario@aspar.org")
        )
        twice = client.post(
            f"/api/v1/users/{volunteer_id}/approve", json={"role": "reception"}, headers=headers
        )
        assert twice.status_code == 409
        assert "ya tiene un rol" in twice.json()["detail"]

        pending = db_session.scalar(select(User).where(User.email == "pendiente@aspar.org"))
        pending.email_verified = False
        db_session.flush()
        unverified = client.post(
            f"/api/v1/users/{pending.id}/approve", json={"role": "reception"}, headers=headers
        )
        assert unverified.status_code == 409
        assert "no confirmó su correo" in unverified.json()["detail"]

    def test_rol_invalido_al_aprobar(self, client, auth_headers, db_session):
        user_id = db_session.scalar(select(User.id).where(User.email == "pendiente@aspar.org"))

        response = client.post(
            f"/api/v1/users/{user_id}/approve", json={"role": "jefe"}, headers=auth_headers()
        )

        assert response.status_code == 422


def test_invitar_genera_contrasena_temporal_legible_y_unica(client, auth_headers):
    headers = auth_headers()
    passwords = [
        client.post(
            "/api/v1/users",
            json={"name": f"Persona {i}", "email": f"persona{i}@aspar.org", "role": "volunteer"},
            headers=headers,
        ).json()["temporaryPassword"]
        for i in range(3)
    ]

    assert all(len(p.split("-")) == 3 and p.split("-")[1].isdigit() for p in passwords)
    assert len(set(passwords)) == 3
