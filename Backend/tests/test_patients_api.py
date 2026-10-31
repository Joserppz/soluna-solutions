from sqlalchemy import select

from app.models import AuditLog, Patient
from tests.conftest import requires_db

pytestmark = requires_db

NEW_PATIENT = {
    "name": "Rosa Mamani",
    "ci": "4455667-LP",
    "birthDate": "1958-05-12",
    "phone": "71234567",
    "address": "Calle 3, Villa Fátima",
    "zone": "Villa Fátima",
    "consent": True,
    "consentDate": "2026-10-20",
    "imageConsent": True,
    "accessStatus": "Activo",
    "anamnesis": {
        "diagnosis": "Enfermedad de Parkinson idiopática",
        "stage": "Estadio II (Bilateral sin alteración del equilibrio)",
        "neurologistCertificate": True,
        "symptomNotes": "Temblor en reposo",
        "medications": "Levodopa 250 mg",
    },
    "contacts": [{"name": "Luis Mamani", "relation": "Hijo", "phone": "70011223"}],
}


def create(client, headers, **overrides):
    return client.post("/api/v1/patients", json=NEW_PATIENT | overrides, headers=headers)


def test_listar_pacientes_requiere_sesion_y_rol(client, auth_headers):
    assert client.get("/api/v1/patients").status_code == 401
    # Una cuenta pendiente de aprobación no ve fichas
    assert client.get("/api/v1/patients", headers=auth_headers(None)).status_code == 403


def test_listar_y_buscar_pacientes(client, auth_headers):
    response = client.get("/api/v1/patients", headers=auth_headers())

    assert response.status_code == 200
    assert {p["ci"] for p in response.json()["items"]} >= {"1234567", "7654321"}
    found = client.get("/api/v1/patients?search=fern", headers=auth_headers()).json()["items"]
    assert [p["name"] for p in found] == ["Miguel Fernández"]
    pending = client.get("/api/v1/patients?status=Pendiente", headers=auth_headers()).json()
    pending = pending["items"]
    assert pending and all(p["accessStatus"] == "Pendiente" for p in pending)


def test_crear_paciente_con_contacto_principal(client, auth_headers, db_session):
    response = create(client, auth_headers("professional"))

    assert response.status_code == 201
    body = response.json()
    assert len(body["id"]) == 36
    assert body["consentDate"] == "2026-10-20"
    assert body["imageConsent"] is True
    assert body["anamnesis"]["neurologistCertificate"] is True
    assert body["contacts"] == [
        {
            "id": body["contacts"][0]["id"],
            "name": "Luis Mamani",
            "relation": "Hijo",
            "phone": "70011223",
            "altPhone": None,
            "isPrimary": True,
        }
    ]
    assert body["active"] is True
    assert db_session.scalar(
        select(AuditLog).where(AuditLog.action == "Registro de ficha y anamnesis de afiliado")
    )


def test_toda_ficha_necesita_al_menos_un_contacto(client, auth_headers):
    response = create(client, auth_headers(), contacts=[])

    assert response.status_code == 422
    assert "contacts" in response.json()["detail"]


def test_consultar_paciente_por_id(client, auth_headers, patient_ids):
    response = client.get(f"/api/v1/patients/{patient_ids['consent']}", headers=auth_headers())

    assert response.status_code == 200
    assert response.json()["name"] == "Elena Rojas"
    missing = "00000000-0000-0000-0000-000000000000"
    assert client.get(f"/api/v1/patients/{missing}", headers=auth_headers()).status_code == 404


def test_ci_duplicada_es_409(client, auth_headers):
    response = create(client, auth_headers(), ci="1234567")

    assert response.status_code == 409
    assert response.json()["detail"] == (
        "Ya existe un afiliado registrado con esa Cédula de Identidad."
    )


def test_validaciones_con_mensajes_en_texto(client, auth_headers):
    cases = {
        "name": ("Ro", "al menos 3 caracteres"),
        "ci": ("12AB", "Cédula de Identidad"),
        "phone": ("12-34", "teléfono"),
        "contacts": ([{"name": "Lu", "relation": "Hijo", "phone": "70011223"}], "familiar"),
        "address": ("x" * 201, "address"),
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
    assert response.json()["consentDate"] is None


def test_actualizar_parcialmente_la_ficha(client, auth_headers, patient_ids):
    response = client.patch(
        f"/api/v1/patients/{patient_ids['consent']}",
        json={"phone": "79998877", "anamnesis": {"medications": "Pramipexol"}},
        headers=auth_headers("professional"),
    )

    assert response.status_code == 200
    body = response.json()
    assert body["phone"] == "79998877"
    assert body["anamnesis"]["medications"] == "Pramipexol"
    assert body["anamnesis"]["diagnosis"] == "Enfermedad de Parkinson idiopática"


def test_retirar_consentimiento_pasa_a_pendiente_y_audita_warning(
    client, auth_headers, db_session, patient_ids
):
    response = client.patch(
        f"/api/v1/patients/{patient_ids['consent']}",
        json={"consent": False},
        headers=auth_headers(),
    )

    assert response.json()["accessStatus"] == "Pendiente"
    assert response.json()["consentDate"] is None
    entry = db_session.scalar(select(AuditLog).where(AuditLog.category == "CONSENTIMIENTO"))
    assert entry.severity == "WARNING"


def test_otorgar_consentimiento_registra_la_fecha(client, auth_headers, patient_ids):
    response = client.patch(
        f"/api/v1/patients/{patient_ids['no_consent']}",
        json={"consent": True, "accessStatus": "Activo"},
        headers=auth_headers(),
    )

    assert response.json()["accessStatus"] == "Activo"
    assert response.json()["consentDate"] is not None


def test_voluntariado_no_puede_registrar_ni_editar(client, auth_headers, patient_ids):
    headers = auth_headers("volunteer")

    assert create(client, headers).status_code == 403
    url = f"/api/v1/patients/{patient_ids['consent']}"
    assert client.patch(url, json={}, headers=headers).status_code == 403


def test_baja_logica_con_motivo_y_reactivacion(client, auth_headers, db_session, patient_ids):
    patient_id = patient_ids["no_consent"]
    url = f"/api/v1/patients/{patient_id}"

    forbidden = client.post(
        f"{url}/deactivate", json={"reason": "Se mudó"}, headers=auth_headers("coordination")
    )
    response = client.post(
        f"{url}/deactivate", json={"reason": "Se mudó a Cochabamba"}, headers=auth_headers()
    )

    assert forbidden.status_code == 403
    assert response.status_code == 200
    assert response.json()["active"] is False
    assert response.json()["deactivationReason"] == "Se mudó a Cochabamba"
    # La ficha se conserva: sale del listado normal pero se puede consultar
    listed = client.get("/api/v1/patients", headers=auth_headers()).json()["items"]
    assert str(patient_id) not in {p["id"] for p in listed}
    everyone = client.get("/api/v1/patients?includeInactive=true", headers=auth_headers()).json()
    assert str(patient_id) in {p["id"] for p in everyone["items"]}
    assert db_session.get(Patient, patient_id) is not None
    assert db_session.scalar(select(AuditLog).where(AuditLog.action == "Baja de ficha de afiliado"))

    reactivated = client.post(f"{url}/reactivate", headers=auth_headers())
    assert reactivated.json()["active"] is True


def test_baja_sin_motivo_es_422_y_no_existe_delete(client, auth_headers, patient_ids):
    url = f"/api/v1/patients/{patient_ids['no_consent']}"

    assert (
        client.post(f"{url}/deactivate", json={"reason": ""}, headers=auth_headers()).status_code
        == 422
    )
    assert client.delete(url, headers=auth_headers()).status_code == 405
