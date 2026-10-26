"""Contrato API <-> Frontend (SCRUM-58 / SCRUM-86).

Lee las interfaces de Frontend/src/types/aspar.ts y verifica que las respuestas reales
del Backend contengan todos sus campos obligatorios.
"""

import re
from pathlib import Path

import pytest

from tests.conftest import requires_db

TYPES_FILE = Path(__file__).resolve().parents[2] / "Frontend" / "src" / "types" / "aspar.ts"


def interface_fields(name: str) -> tuple[set[str], set[str]]:
    """Devuelve (campos obligatorios, campos opcionales) de una interface TypeScript."""
    source = TYPES_FILE.read_text(encoding="utf-8")
    match = re.search(rf"export interface {name} \{{(.*?)\n\}}", source, re.DOTALL)
    assert match, f"No se encontró la interface {name} en {TYPES_FILE}"
    required, optional = set(), set()
    depth = 0
    for line in match.group(1).splitlines():
        field = re.match(r"^\s{2}(\w+)(\?)?:", line)
        if field and depth == 0:
            (optional if field.group(2) else required).add(field.group(1))
        depth += line.count("{") - line.count("}")
    return required, optional


def assert_matches(name: str, payload: dict) -> None:
    required, optional = interface_fields(name)
    missing = required - set(payload)
    assert not missing, f"{name}: faltan campos {sorted(missing)}"
    assert required | optional <= set(payload) | optional


pytestmark = pytest.mark.skipif(not TYPES_FILE.exists(), reason="Requiere la carpeta Frontend")


def test_se_leen_las_interfaces_del_frontend():
    required, optional = interface_fields("Patient")

    assert {"id", "name", "ci", "anamnesis", "accessStatus"} <= required
    assert {"consentDate", "createdAt", "updatedAt"} <= optional


@requires_db
class TestContratoLoginYPacientes:
    def login(self, client):
        return client.post(
            "/api/v1/auth/login",
            json={"email": "dayana.rojas@ucb.edu.bo", "password": "Admin123"},
        ).json()

    def test_login_cumple_login_response_dto(self, client):
        body = self.login(client)

        assert_matches("LoginResponseDto", body)
        assert_matches("User", body["user"])
        assert body["token_type"] == "bearer"

    def test_refresh_cumple_refresh_response_dto(self, client):
        token = self.login(client)["access_token"]

        body = client.post(
            "/api/v1/auth/refresh", headers={"Authorization": f"Bearer {token}"}
        ).json()

        assert_matches("RefreshResponseDto", body)

    def test_pacientes_cumplen_patient_y_clinical_anamnesis(self, client, auth_headers):
        patients = client.get("/api/v1/patients", headers=auth_headers()).json()

        for patient in patients:
            assert_matches("Patient", patient)
            assert_matches("ClinicalAnamnesis", patient["anamnesis"])

    def test_usuarios_y_bitacora_cumplen_user_y_audit_event(self, client, auth_headers):
        headers = auth_headers()

        for user in client.get("/api/v1/users", headers=headers).json():
            assert_matches("User", user)
        for event in client.get("/api/v1/audit", headers=headers).json():
            assert_matches("AuditEvent", event)

    def test_errores_devuelven_detail_como_texto(self, client, auth_headers):
        responses = [
            client.post("/api/v1/auth/login", json={"email": "x@y.co", "password": "mala"}),
            client.post("/api/v1/auth/login", json={}),
            client.get("/api/v1/patients"),
            client.get("/api/v1/patients/p-x", headers=auth_headers()),
            client.get("/api/v1/users", headers=auth_headers("Voluntario")),
        ]

        for response in responses:
            assert isinstance(response.json()["detail"], str), response.request.url
