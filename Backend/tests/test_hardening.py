"""Endurecimiento (S2-S6): límites de peticiones, bitácora agrupada y perímetro HTTP."""

import pytest
from fastapi.testclient import TestClient
from sqlalchemy import select, text

from app.core.config import settings
from app.core.database import escape_like
from app.models import AuditLog
from tests.conftest import requires_db

pytestmark = requires_db


@pytest.fixture
def limits(migrated_engine, monkeypatch):
    """Activa los límites con la tabla limpia (sus contadores van en su propia transacción)."""
    monkeypatch.setattr(settings, "rate_limits_enabled", True)
    with migrated_engine.begin() as conn:
        conn.execute(text("delete from rate_limits"))
    yield
    with migrated_engine.begin() as conn:
        conn.execute(text("delete from rate_limits"))


def bad_login(client, email="coordinacion@aspar.org"):
    return client.post("/api/v1/auth/login", json={"email": email, "password": "mala-2026"})


def test_limite_por_cuenta_responde_429_con_retry_after(client, limits):
    responses = [bad_login(client) for _ in range(11)]

    assert [r.status_code for r in responses[:10]] == [401] * 10
    assert responses[10].status_code == 429
    assert "Demasiados intentos" in responses[10].json()["detail"]
    assert int(responses[10].headers["Retry-After"]) > 0


def test_limite_por_ip_cubre_cuentas_distintas(client, limits):
    responses = [bad_login(client, f"persona{i}@aspar.org") for i in range(31)]

    assert responses[29].status_code == 401
    assert responses[30].status_code == 429


def test_los_intentos_quedan_contados_aunque_la_peticion_falle(client, limits, migrated_engine):
    bad_login(client)

    with migrated_engine.connect() as conn:
        buckets = dict(conn.execute(text("select bucket, hits from rate_limits")).all())
    assert buckets["login:cuenta:coordinacion@aspar.org"] == 1
    assert buckets["login:ip:testclient"] == 1


def test_registro_limitado_por_ip(client, limits, outbox, captcha):
    payload = {"name": "Rosa", "password": "Rosa2026x", "turnstileToken": "humano"}
    responses = [
        client.post("/api/v1/auth/register", json=payload | {"email": f"r{i}@gmail.com"})
        for i in range(6)
    ]

    assert responses[4].status_code == 202
    assert responses[5].status_code == 429


def test_intentos_fallidos_repetidos_se_agrupan_en_una_fila(client, db_session):
    for _ in range(3):
        bad_login(client, "nadie@aspar.org")

    rows = db_session.scalars(
        select(AuditLog).where(AuditLog.action == "Intento fallido de inicio de sesión")
    ).all()
    assert len(rows) == 1
    assert rows[0].occurrences == 3
    assert rows[0].last_occurred_at >= rows[0].date


def test_accesos_bloqueados_repetidos_se_agrupan(client, auth_headers, db_session):
    for _ in range(4):
        client.get("/api/v1/users", headers=auth_headers("volunteer"))

    blocked = db_session.scalars(
        select(AuditLog).where(AuditLog.action == "Intento de acceso restringido bloqueado")
    ).all()
    assert [row.occurrences for row in blocked] == [4]


def test_buscar_comodines_no_devuelve_todo(client, auth_headers):
    headers = auth_headers()

    for term in ("%", "_", "\\"):
        found = client.get("/api/v1/patients", params={"search": term}, headers=headers).json()
        assert found["items"] == []
    assert escape_like("50%_a\\b") == "50\\%\\_a\\\\b"


def test_cabeceras_de_seguridad(client):
    response = client.get("/api/v1/health")

    assert response.headers["X-Content-Type-Options"] == "nosniff"
    assert response.headers["X-Frame-Options"] == "DENY"
    assert response.headers["Referrer-Policy"] == "no-referrer"
    assert "default-src 'none'" in response.headers["Content-Security-Policy"]
    assert response.headers["Cache-Control"] == "no-store"
    # HSTS solo en producción
    assert "Strict-Transport-Security" not in response.headers


def test_cors_solo_para_el_frontend_y_sus_encabezados(client):
    allowed = client.options(
        "/api/v1/auth/login",
        headers={
            "Origin": "http://localhost:5173",
            "Access-Control-Request-Method": "POST",
            "Access-Control-Request-Headers": "content-type,x-csrf-token",
        },
    )
    other = client.options(
        "/api/v1/auth/login",
        headers={"Origin": "https://otro.com", "Access-Control-Request-Method": "POST"},
    )

    assert allowed.status_code == 200
    assert allowed.headers["Access-Control-Allow-Origin"] == "http://localhost:5173"
    assert allowed.headers["Access-Control-Allow-Credentials"] == "true"
    assert "x-csrf-token" in allowed.headers["Access-Control-Allow-Headers"].lower()
    assert "Access-Control-Allow-Origin" not in other.headers


def test_en_produccion_no_hay_docs_y_se_exige_https(monkeypatch):
    from app.main import create_app

    monkeypatch.setattr(settings, "env", "prod")
    prod = TestClient(create_app(), base_url="https://api.aspar.com")

    for path in ("/docs", "/redoc", "/openapi.json"):
        assert prod.get(path).status_code == 404
    health = prod.get("/api/v1/health")
    assert health.headers["Strict-Transport-Security"].startswith("max-age=31536000")
