from sqlalchemy import select

from app.models import AuditLog
from tests.conftest import requires_db

pytestmark = requires_db

NEW_PATIENT = {
    "name": "Rosa Mamani",
    "ci": "4455667-LP",
    "phone": "71234567",
    "address": "Zona Sur, La Paz",
    "emergencyContact": "Luis Mamani (70011223)",
    "caregiverRelation": "Hijo / Cuidador principal",
    "consent": True,
    "consentDate": "2026-10-20",
    "accessStatus": "Activo",
    "anamnesis": {
        "diagnosis": "Enfermedad de Parkinson idiopática",
        "stage": "Estadio II (Bilateral sin alteración del equilibrio)",
        "neurologistCertificate": True,
        "symptomNotes": "Temblor en reposo",
        "physicalEvaluation": "Marcha con apoyo",
        "speechEvaluation": "Hipofonía leve",
        "psychologicalEvaluation": "Ánimo estable",
        "medications": "Levodopa 250 mg",
    },
}


def create(client, headers, **overrides):
    return client.post("/api/v1/patients", json=NEW_PATIENT | overrides, headers=headers)


def test_listar_pacientes_requiere_sesion(client):
    assert client.get("/api/v1/patients").status_code == 401


def test_listar_y_buscar_pacientes(client, auth_headers):
    response = client.get("/api/v1/patients", headers=auth_headers())

    assert response.status_code == 200
    assert {p["ci"] for p in response.json()} >= {"1234567", "7654321"}
    found = client.get("/api/v1/patients?search=fern", headers=auth_headers()).json()
    assert [p["name"] for p in found] == ["Miguel Fernández"]
    pending = client.get("/api/v1/patients?status=Pendiente", headers=auth_headers()).json()
    assert all(p["accessStatus"] == "Pendiente" for p in pending)


def test_crear_paciente_devuelve_201_con_formato_del_frontend(client, auth_headers, db_session):
    response = create(client, auth_headers("Profesional"))

    assert response.status_code == 201
    body = response.json()
    assert body["id"].startswith("p-")
    assert body["emergencyContact"] == "Luis Mamani (70011223)"
    assert body["consentDate"] == "2026-10-20"
    assert body["anamnesis"]["neurologistCertificate"] is True
    assert db_session.scalar(
        select(AuditLog).where(AuditLog.action == "Registro de ficha y anamnesis de paciente")
    )


def test_consultar_paciente_por_id(client, auth_headers):
    response = client.get("/api/v1/patients/p-1", headers=auth_headers())

    assert response.status_code == 200
    assert response.json()["name"] == "Elena Rojas"
    assert client.get("/api/v1/patients/p-x", headers=auth_headers()).status_code == 404


def test_ci_duplicada_es_409(client, auth_headers):
    response = create(client, auth_headers(), ci="1234567")

    assert response.status_code == 409
    assert response.json()["detail"] == (
        "Ya existe un paciente registrado con esa Cédula de Identidad."
    )


def test_validaciones_con_los_mismos_mensajes_del_frontend(client, auth_headers):
    cases = {
        "name": ("Ro", "al menos 3 caracteres"),
        "ci": ("12AB", "Cédula de Identidad"),
        "phone": ("12-34", "teléfono"),
        "emergencyContact": ("  ", "contacto de emergencia"),
    }
    for field, (value, message) in cases.items():
        response = create(client, auth_headers(), **{field: value})
        assert response.status_code == 422, field
        assert message in response.json()["detail"], field


def test_no_se_activa_sin_consentimiento(client, auth_headers):
    response = create(client, auth_headers(), consent=False, consentDate="")

    assert response.status_code == 422
    assert "consentimiento informado" in response.json()["detail"]


def test_sin_consentimiento_se_registra_pendiente_sin_fecha(client, auth_headers):
    response = create(
        client, auth_headers(), consent=False, consentDate="", accessStatus="Pendiente"
    )

    assert response.status_code == 201
    assert response.json()["consentDate"] == ""


def test_actualizar_parcialmente_la_ficha(client, auth_headers):
    response = client.patch(
        "/api/v1/patients/p-1",
        json={"phone": "79998877", "anamnesis": {"medications": "Pramipexol"}},
        headers=auth_headers("Profesional"),
    )

    assert response.status_code == 200
    body = response.json()
    assert body["phone"] == "79998877"
    assert body["anamnesis"]["medications"] == "Pramipexol"
    assert body["anamnesis"]["diagnosis"] == "Enfermedad de Parkinson idiopática"


def test_retirar_consentimiento_pasa_a_pendiente_y_audita_warning(client, auth_headers, db_session):
    response = client.patch("/api/v1/patients/p-1", json={"consent": False}, headers=auth_headers())

    assert response.json()["accessStatus"] == "Pendiente"
    assert response.json()["consentDate"] == ""
    entry = db_session.scalar(select(AuditLog).where(AuditLog.category == "CONSENTIMIENTO"))
    assert entry.severity == "WARNING"


def test_otorgar_consentimiento_registra_la_fecha(client, auth_headers):
    response = client.patch(
        "/api/v1/patients/p-2",
        json={"consent": True, "accessStatus": "Activo"},
        headers=auth_headers(),
    )

    assert response.json()["accessStatus"] == "Activo"
    assert response.json()["consentDate"] != ""


def test_voluntario_no_puede_registrar_ni_editar(client, auth_headers):
    headers = auth_headers("Voluntario")

    assert create(client, headers).status_code == 403
    assert client.patch("/api/v1/patients/p-1", json={}, headers=headers).status_code == 403


def test_solo_administrador_elimina_fichas(client, auth_headers, db_session):
    assert (
        client.delete("/api/v1/patients/p-2", headers=auth_headers("Coordinador")).status_code
        == 403
    )

    response = client.delete("/api/v1/patients/p-2", headers=auth_headers())

    assert response.status_code == 200
    assert client.get("/api/v1/patients/p-2", headers=auth_headers()).status_code == 404
    assert db_session.scalar(select(AuditLog).where(AuditLog.severity == "CRITICAL"))
