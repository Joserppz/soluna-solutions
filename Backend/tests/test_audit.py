"""RF-17: bitácora de operaciones sensibles registrada desde la capa de servicios."""

import pytest
from sqlalchemy import select, text
from sqlalchemy.exc import InternalError

from app.models import AuditLog
from app.services import audit_service
from tests.conftest import requires_db

pytestmark = requires_db


def actions(db_session) -> list[str]:
    return list(db_session.scalars(select(AuditLog.action)))


def test_consultar_bitacora_con_formato_del_frontend(client, auth_headers):
    response = client.get("/api/v1/audit", headers=auth_headers())

    assert response.status_code == 200
    event = response.json()[0]
    assert set(event) == {
        "id",
        "date",
        "actor",
        "actorRole",
        "category",
        "severity",
        "action",
        "detail",
        "ipAddress",
    }
    assert event["action"] == "Inicio de sesión administrativo"


def test_filtros_por_categoria_severidad_y_actor(client, auth_headers):
    headers = auth_headers()
    client.post("/api/v1/auth/login", json={"email": "voluntario@aspar.org", "password": "mala"})

    warnings = client.get("/api/v1/audit?category=AUTENTICACION&severity=WARNING", headers=headers)
    by_actor = client.get("/api/v1/audit?actor=VOLUNTARIO", headers=headers)

    assert [e["severity"] for e in warnings.json()] == ["WARNING"]
    assert {e["actor"] for e in by_actor.json()} == {"voluntario@aspar.org"}


def test_filtro_invalido_es_422(client, auth_headers):
    response = client.get("/api/v1/audit?severity=GRAVE", headers=auth_headers())

    assert response.status_code == 422
    assert "Severidad inválida" in response.json()["detail"]


def test_solo_administrador_consulta_y_el_intento_queda_registrado(
    client, auth_headers, db_session
):
    response = client.get("/api/v1/audit", headers=auth_headers("Coordinador"))

    assert response.status_code == 403
    blocked = db_session.scalar(
        select(AuditLog).where(AuditLog.action == "Intento de acceso restringido bloqueado")
    )
    assert blocked.actor == "coordinacion@aspar.org"
    assert "/api/v1/audit" in blocked.detail


def test_operaciones_sensibles_quedan_en_la_bitacora(client, auth_headers, db_session):
    headers = auth_headers()
    client.patch("/api/v1/patients/p-1", json={"phone": "70000011"}, headers=headers)
    client.patch("/api/v1/patients/p-1", json={"consent": False}, headers=headers)
    client.patch("/api/v1/users/u-vol", json={"department": "Apoyo"}, headers=headers)
    client.post("/api/v1/auth/logout", headers=headers)

    registered = actions(db_session)
    for expected in (
        "Inicio de sesión administrativo",
        "Actualización de ficha de paciente",
        "Actualización de consentimiento / acceso de paciente",
        "Actualización de usuario y rol",
        "Cierre de sesión",
    ):
        assert expected in registered


def test_la_bitacora_no_se_puede_modificar_ni_borrar(db_session):
    entry = audit_service.record(
        db_session,
        actor="test",
        actor_role="Sistema",
        category="SISTEMA",
        severity="INFO",
        action="Prueba",
        detail="Prueba de inmutabilidad",
    )
    db_session.commit()

    with pytest.raises(InternalError, match="no se puede modificar"), db_session.begin_nested():
        db_session.execute(
            text("update audit_logs set detail = 'x' where id = :i"), {"i": entry.id}
        )
    with pytest.raises(InternalError, match="no se puede modificar"), db_session.begin_nested():
        db_session.execute(text("delete from audit_logs where id = :i"), {"i": entry.id})


def test_categoria_desconocida_es_rechazada_en_el_servicio(db_session):
    with pytest.raises(ValueError, match="Categoría"):
        audit_service.record(
            db_session,
            actor="x",
            actor_role="Sistema",
            category="OTRA",
            severity="INFO",
            action="x",
            detail="x",
        )
