"""Núcleo del Backend: configuración, IP real, errores, unidad de trabajo y logs."""

import json
import logging
from datetime import UTC, datetime, timedelta

import pytest
from fastapi import FastAPI
from fastapi.testclient import TestClient
from pydantic import ValidationError as SettingsValidationError
from sqlalchemy import select
from sqlalchemy.exc import IntegrityError, OperationalError
from starlette.requests import Request

from app.core.config import Settings
from app.core.database import after_commit, on_rollback, unit_of_work
from app.core.errors import Conflict, DomainError, NotFound, register_error_handlers
from app.core.logging import JsonFormatter, RequestContextMiddleware
from app.core.network import client_ip
from tests.conftest import requires_db


# ---------------------------------------------------------------------------
# Configuración
# ---------------------------------------------------------------------------
def settings_with(**values) -> Settings:
    base = {"database_url": "postgresql://a:b@localhost/c", "jwt_secret": "x" * 40}
    return Settings(_env_file=None, **(base | values))


def test_cors_acepta_una_lista_separada_por_comas():
    settings = settings_with(cors_origins="https://aspar.com, https://staging.aspar.com,")

    assert settings.cors_origins == ["https://aspar.com", "https://staging.aspar.com"]


@pytest.mark.parametrize("secret", ["corto", "reemplazar-por-un-secreto-aleatorio"])
def test_jwt_secret_debe_ser_aleatorio_y_largo(secret):
    with pytest.raises(SettingsValidationError, match="JWT_SECRET"):
        settings_with(jwt_secret=secret)


def test_el_secreto_no_aparece_al_imprimir_la_configuracion():
    settings = settings_with(supabase_service_role_key="clave-super-secreta")

    assert "clave-super-secreta" not in repr(settings)
    assert settings.supabase_service_role_key.get_secret_value() == "clave-super-secreta"


# ---------------------------------------------------------------------------
# IP real del cliente (Cloud Run)
# ---------------------------------------------------------------------------
def request_from(peer: str, forwarded: str | None = None) -> Request:
    headers = [(b"x-forwarded-for", forwarded.encode())] if forwarded is not None else []
    return Request({"type": "http", "headers": headers, "client": (peer, 1234)})


def test_sin_proxies_de_confianza_se_ignora_x_forwarded_for():
    request = request_from("10.0.0.5", "1.2.3.4")

    assert client_ip(request, trusted_hops=0) == "10.0.0.5"


def test_cloud_run_usa_la_ip_que_agrego_google_y_no_la_inventada():
    # El cliente manda "1.2.3.4" falso; Google agrega al final la IP real
    request = request_from("169.254.1.1", "1.2.3.4, 200.87.10.20")

    assert client_ip(request, trusted_hops=1) == "200.87.10.20"


def test_con_balanceador_extra_se_salta_su_ip():
    request = request_from("169.254.1.1", "1.2.3.4, 200.87.10.20, 35.191.0.1")

    assert client_ip(request, trusted_hops=2) == "200.87.10.20"


@pytest.mark.parametrize("forwarded", [None, "", "no-es-una-ip", "200.87.10.20"])
def test_encabezado_ausente_invalido_o_corto_usa_la_conexion(forwarded):
    request = request_from("169.254.1.1", forwarded)

    assert client_ip(request, trusted_hops=2) == "169.254.1.1"


def test_acepta_ipv6():
    request = request_from("169.254.1.1", "2800:cd0:1::1")

    assert client_ip(request, trusted_hops=1) == "2800:cd0:1::1"


# ---------------------------------------------------------------------------
# Manejadores globales de error
# ---------------------------------------------------------------------------
@pytest.fixture
def error_client():
    app = FastAPI()
    app.add_middleware(RequestContextMiddleware)
    register_error_handlers(app)

    @app.get("/no-existe")
    def not_found():
        raise NotFound("Paciente no encontrado.")

    @app.get("/duplicado")
    def duplicate():
        raise IntegrityError("insert", {}, Exception("unique"))

    @app.get("/sin-base")
    def database_down():
        raise OperationalError("select 1", {}, Exception("timeout"))

    @app.get("/falla")
    def unexpected():
        raise RuntimeError("detalle interno que no debe salir")

    return TestClient(app, raise_server_exceptions=False)


def test_error_de_dominio_usa_su_codigo_y_mensaje(error_client):
    response = error_client.get("/no-existe")

    assert response.status_code == 404
    assert response.json() == {"detail": "Paciente no encontrado."}


def test_integrity_error_es_409(error_client):
    response = error_client.get("/duplicado")

    assert response.status_code == 409
    assert "ya existe" in response.json()["detail"]


def test_operational_error_es_503(error_client):
    response = error_client.get("/sin-base")

    assert response.status_code == 503
    assert "no está disponible" in response.json()["detail"]


def test_error_inesperado_es_500_en_json_con_codigo_y_sin_detalles(error_client):
    response = error_client.get("/falla", headers={"X-Request-ID": "pedido-1234abcd"})

    assert response.status_code == 500
    assert "pedido-1234abcd" in response.json()["detail"]
    assert "detalle interno" not in response.text
    assert response.headers["X-Request-ID"] == "pedido-1234abcd"


def test_request_id_invalido_se_reemplaza(error_client):
    response = error_client.get("/no-existe", headers={"X-Request-ID": "<script>"})

    assert response.headers["X-Request-ID"] != "<script>"
    assert len(response.headers["X-Request-ID"]) == 32


# ---------------------------------------------------------------------------
# Unidad de trabajo
# ---------------------------------------------------------------------------
class FakeSession:
    def __init__(self, fail_commit: bool = False):
        self.info: dict = {}
        self.events: list[str] = []
        self.fail_commit = fail_commit

    def commit(self):
        if self.fail_commit:
            raise IntegrityError("commit", {}, Exception("unique"))
        self.events.append("commit")

    def rollback(self):
        self.events.append("rollback")


def run(session: FakeSession, body=None):
    flow = unit_of_work(session)
    db = next(flow)
    after_commit(db, lambda: session.events.append("después del commit"))
    on_rollback(db, lambda: session.events.append("deshacer"))
    if body is None:
        with pytest.raises(StopIteration):
            next(flow)
    else:
        with pytest.raises(type(body)):
            flow.throw(body)


def test_peticion_exitosa_confirma_y_ejecuta_las_acciones_posteriores():
    session = FakeSession()
    run(session)

    assert session.events == ["commit", "después del commit"]


def test_error_revierte_y_deshace_lo_externo():
    session = FakeSession()
    run(session, RuntimeError("falla"))

    assert session.events == ["rollback", "deshacer"]


def test_error_de_dominio_comun_revierte():
    session = FakeSession()
    run(session, Conflict("Ya existe"))

    assert session.events == ["rollback", "deshacer"]


def test_error_con_persist_guarda_la_bitacora_antes_de_responder():
    session = FakeSession()
    run(session, DomainError("Acceso bloqueado", persist=True))

    assert session.events == ["commit", "después del commit"]


def test_si_el_commit_falla_se_revierte_y_se_propaga_el_error():
    session = FakeSession(fail_commit=True)

    flow = unit_of_work(session)
    db = next(flow)
    on_rollback(db, lambda: session.events.append("deshacer"))
    with pytest.raises(IntegrityError):
        next(flow)

    assert session.events == ["rollback", "deshacer"]


def test_una_accion_posterior_que_falla_no_rompe_la_respuesta(caplog):
    session = FakeSession()
    flow = unit_of_work(session)
    db = next(flow)

    def broken():
        raise ConnectionError("Storage caído")

    after_commit(db, broken)
    with caplog.at_level(logging.ERROR), pytest.raises(StopIteration):
        next(flow)

    assert session.events == ["commit"]
    assert "Falló una acción posterior" in caplog.text


# ---------------------------------------------------------------------------
# Logs en JSON
# ---------------------------------------------------------------------------
def test_formato_json_con_severidad_y_campos_extra():
    record = logging.LogRecord("aspar.test", logging.WARNING, "", 0, "hola %s", ("ASPAR",), None)
    record.status = 409

    entry = json.loads(JsonFormatter().format(record))

    assert entry["severity"] == "WARNING"
    assert entry["message"] == "hola ASPAR"
    assert entry["status"] == 409
    assert "request_id" in entry


# ---------------------------------------------------------------------------
# Actividad de la sesión: se escribe como mucho una vez por minuto
# ---------------------------------------------------------------------------
@requires_db
def test_actividad_de_la_sesion_se_actualiza_como_mucho_cada_minuto(
    client, auth_headers, db_session
):
    from app.models import UserSession

    headers = auth_headers()
    session = db_session.scalars(
        select(UserSession).order_by(UserSession.created_at.desc())
    ).first()
    first_activity = session.last_activity_at

    client.get("/api/v1/auth/me", headers=headers)
    db_session.refresh(session)
    assert session.last_activity_at == first_activity

    session.last_activity_at = datetime.now(UTC) - timedelta(minutes=2)
    db_session.flush()
    client.get("/api/v1/auth/me", headers=headers)
    db_session.refresh(session)
    assert session.last_activity_at > datetime.now(UTC) - timedelta(seconds=30)
