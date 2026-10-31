"""Permisos dinámicos por rol (tabla role_permissions) y protección del rol del sistema."""

import pytest
from sqlalchemy import delete, select, text, update
from sqlalchemy.exc import InternalError

from app.models import AuditLog, Permission, Role
from app.modules.users.models import role_permissions
from tests.conftest import requires_db

pytestmark = requires_db


def role(db_session, key: str) -> Role:
    return db_session.scalar(select(Role).where(Role.key == key))


def grant(db_session, key: str, permission: str) -> None:
    db_session.execute(
        role_permissions.insert().values(
            role_id=role(db_session, key).id, permission_key=permission
        )
    )
    db_session.commit()


def revoke(db_session, key: str, permission: str) -> None:
    db_session.execute(
        delete(role_permissions).where(
            role_permissions.c.role_id == role(db_session, key).id,
            role_permissions.c.permission_key == permission,
        )
    )
    db_session.commit()


def permissions_of(client, headers) -> list[str]:
    return client.get("/api/v1/auth/me", headers=headers).json()["permissions"]


def test_la_sesion_informa_los_permisos_del_rol(client, auth_headers, db_session):
    all_permissions = sorted(db_session.scalars(select(Permission.key)))

    assert permissions_of(client, auth_headers()) == all_permissions
    assert permissions_of(client, auth_headers("volunteer")) == [
        "attendance:write",
        "patients:read",
    ]
    assert permissions_of(client, auth_headers(None)) == []


def test_quitar_un_permiso_tiene_efecto_inmediato(client, auth_headers, db_session):
    headers = auth_headers("volunteer")
    assert client.get("/api/v1/patients", headers=headers).status_code == 200

    revoke(db_session, "volunteer", "patients:read")

    response = client.get("/api/v1/patients", headers=headers)
    assert response.status_code == 403
    assert "Voluntariado" in response.json()["detail"]
    blocked = db_session.scalar(
        select(AuditLog).where(AuditLog.action == "Intento de acceso restringido bloqueado")
    )
    assert "patients:read" in blocked.detail


def test_dar_un_permiso_habilita_la_operacion(client, auth_headers, db_session):
    headers = auth_headers("volunteer")
    assert client.get("/api/v1/users", headers=headers).status_code == 403

    grant(db_session, "volunteer", "users:manage")

    assert client.get("/api/v1/users", headers=headers).status_code == 200


def test_el_consentimiento_manda_aunque_el_rol_tenga_permiso_clinico(
    client, auth_headers, db_session, patient_ids
):
    grant(db_session, "reception", "patients:read_clinical")
    headers = auth_headers("reception")

    with_consent = client.get(f"/api/v1/patients/{patient_ids['consent']}", headers=headers)
    without = client.get(f"/api/v1/patients/{patient_ids['no_consent']}", headers=headers)

    assert with_consent.json()["clinicalAccess"] is True
    assert without.json()["clinicalAccess"] is False
    assert without.json()["anamnesis"]["symptomNotes"] == ""


def test_administracion_tiene_siempre_todos_los_permisos(client, auth_headers, db_session):
    from app.models import User
    from app.modules.auth.dependencies import load_permissions
    from app.modules.users.models import PERMISSION_KEYS

    db_session.add(Permission(key="nuevo:permiso", description="Permiso agregado después"))
    db_session.commit()
    admin = db_session.scalar(select(User).where(User.email == "admin@aspar.org"))

    # En el servidor, Administración tiene también el permiso agregado después
    assert "nuevo:permiso" in load_permissions(db_session, admin)
    # La sesión publica solo las claves del contrato: la clave nueva no rompe el login
    assert set(permissions_of(client, auth_headers())) == set(PERMISSION_KEYS)


def test_los_permisos_de_administracion_no_se_pueden_quitar(db_session):
    with pytest.raises(InternalError, match="rol del sistema"), db_session.begin_nested():
        db_session.execute(
            delete(role_permissions).where(
                role_permissions.c.role_id == role(db_session, "admin").id
            )
        )


@pytest.mark.parametrize(
    "statement",
    [
        "delete from roles where key = 'admin'",
        "update roles set is_system = false where key = 'admin'",
        "update roles set key = 'jefe' where key = 'volunteer'",
    ],
)
def test_claves_y_rol_del_sistema_no_cambian(db_session, statement):
    with pytest.raises(InternalError), db_session.begin_nested():
        db_session.execute(text(statement))


def test_el_nombre_visible_de_un_rol_si_se_puede_cambiar(client, auth_headers, db_session):
    db_session.execute(update(Role).where(Role.key == "volunteer").values(name="Voluntarios"))
    db_session.commit()

    response = client.get("/api/v1/auth/me", headers=auth_headers("volunteer"))

    assert response.json()["user"]["roleName"] == "Voluntarios"
    assert response.json()["user"]["role"] == "volunteer"


def test_las_claves_del_contrato_son_las_de_la_base(db_session):
    """PermissionKey (OpenAPI y tipos del frontend) y la tabla permissions no se separan."""
    from typing import get_args

    from app.modules.users.models import PERMISSION_KEYS, PermissionKey

    keys = set(db_session.scalars(text("select key from permissions")))

    assert keys == set(PERMISSION_KEYS) == set(get_args(PermissionKey))
