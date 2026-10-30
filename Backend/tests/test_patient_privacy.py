"""RNF-06: protección de datos clínicos y documentos privados (SCRUM-137)."""

import uuid

import httpx
import pytest
from sqlalchemy import select

from app.adapters.storage import get_private_storage
from app.main import app
from app.models import AuditLog, PatientDocument
from tests.conftest import requires_db

pytestmark = requires_db


class FakeStorage:
    def __init__(self):
        self.files: dict[str, bytes] = {}
        self.fail = False

    def upload(self, path, content, content_type):
        if self.fail:
            raise httpx.ConnectError("sin conexión")
        self.files[path] = content

    def signed_url(self, path, expires_in):
        return f"https://storage.test/sign/{path}?token=abc&expires={expires_in}"

    def delete(self, path):
        if self.fail:
            raise httpx.ConnectError("sin conexión")
        self.files.pop(path, None)


@pytest.fixture
def storage():
    fake = FakeStorage()
    app.dependency_overrides[get_private_storage] = lambda: fake
    yield fake
    app.dependency_overrides.pop(get_private_storage, None)


def patient(client, headers, patient_id):
    return client.get(f"/api/v1/patients/{patient_id}", headers=headers).json()


class TestAnamnesis:
    def test_personal_clinico_ve_la_anamnesis_con_consentimiento_activo(
        self, client, auth_headers, patient_ids
    ):
        for role in ("admin", "coordination", "professional"):
            body = patient(client, auth_headers(role), patient_ids["consent"])
            assert body["clinicalAccess"] is True, role
            assert body["anamnesis"]["medications"].startswith("Levodopa"), role

    def test_recepcion_y_voluntario_no_ven_la_anamnesis(self, client, auth_headers, patient_ids):
        for role in ("reception", "volunteer"):
            body = patient(client, auth_headers(role), patient_ids["consent"])
            assert body["clinicalAccess"] is False, role
            assert set(body["anamnesis"].values()) <= {"", False}, role
            assert body["name"] == "Elena Rojas", role

    def test_sin_consentimiento_nadie_ve_la_anamnesis(self, client, auth_headers, patient_ids):
        body = patient(client, auth_headers("admin"), patient_ids["no_consent"])

        assert body["clinicalAccess"] is False
        assert body["anamnesis"]["symptomNotes"] == ""

    def test_listado_tambien_oculta_la_anamnesis(self, client, auth_headers, patient_ids):
        listing = client.get("/api/v1/patients", headers=auth_headers("reception")).json()

        assert all(p["anamnesis"]["medications"] == "" for p in listing)

    def test_consulta_de_ficha_clinica_queda_auditada(
        self, client, auth_headers, db_session, patient_ids
    ):
        patient(client, auth_headers("professional"), patient_ids["consent"])

        assert db_session.scalar(
            select(AuditLog).where(AuditLog.action == "Consulta de ficha clínica")
        )

    def test_recepcion_registra_filiacion_con_datos_de_admision(
        self, client, auth_headers, patient_ids
    ):
        response = client.post(
            "/api/v1/patients",
            json={
                "name": "Juana Quispe",
                "ci": "5566778",
                "phone": "76543210",
                "contacts": [{"name": "Pedro Quispe", "relation": "Hijo", "phone": "70011223"}],
                "accessStatus": "Pendiente",
                "anamnesis": {
                    "diagnosis": "Enfermedad de Parkinson idiopática",
                    "stage": "Estadio I (Leve unilateral)",
                    "neurologistCertificate": True,
                    "symptomNotes": "",
                },
            },
            headers=auth_headers("reception"),
        )

        assert response.status_code == 201

    def test_recepcion_no_registra_evaluaciones_clinicas(
        self, client, auth_headers, db_session, patient_ids
    ):
        response = client.patch(
            f"/api/v1/patients/{patient_ids['consent']}",
            json={"anamnesis": {"medications": "Otra"}},
            headers=auth_headers("reception"),
        )

        assert response.status_code == 403
        assert "personal clínico" in response.json()["detail"]
        assert db_session.scalar(
            select(AuditLog).where(
                AuditLog.action == "Intento de registrar datos clínicos sin permiso"
            )
        )

    def test_recepcion_puede_actualizar_consentimiento(self, client, auth_headers, patient_ids):
        response = client.patch(
            f"/api/v1/patients/{patient_ids['no_consent']}",
            json={"consent": True, "accessStatus": "Activo"},
            headers=auth_headers("reception"),
        )

        assert response.status_code == 200
        assert response.json()["clinicalAccess"] is False


class TestDocumentosPrivados:
    def upload(
        self,
        client,
        headers,
        patient_id,
        content=b"%PDF-1.4 prueba",
        content_type="application/pdf",
    ):
        return client.post(
            f"/api/v1/patients/{patient_id}/documents",
            data={"documentType": "CI"},
            files={"file": ("ci elena.pdf", content, content_type)},
            headers=headers,
        )

    def test_subir_listar_y_obtener_enlace_temporal(
        self, client, auth_headers, storage, patient_ids
    ):
        uploaded = self.upload(client, auth_headers("reception"), patient_ids["consent"])

        assert uploaded.status_code == 201
        doc = uploaded.json()
        assert doc["documentType"] == "CI"
        assert doc["sizeBytes"] == len(b"%PDF-1.4 prueba")
        base = f"/api/v1/patients/{patient_ids['consent']}/documents"
        assert list(storage.files) == [f"{patient_ids['consent']}/{doc['id']}.pdf"]

        listing = client.get(base, headers=auth_headers())
        assert [d["id"] for d in listing.json()] == [doc["id"]]

        link = client.get(f"{base}/{doc['id']}/url", headers=auth_headers("professional")).json()
        assert link["expiresIn"] == 300
        assert link["url"].startswith(f"https://storage.test/sign/{patient_ids['consent']}/")

    def test_roles_no_clinicos_no_listan_ni_descargan(
        self, client, auth_headers, storage, patient_ids
    ):
        doc_id = self.upload(client, auth_headers(), patient_ids["consent"]).json()["id"]

        for role in ("reception", "volunteer"):
            headers = auth_headers(role)
            base = f"/api/v1/patients/{patient_ids['consent']}/documents"
            assert client.get(base, headers=headers).status_code == 403
            url = f"{base}/{doc_id}/url"
            assert client.get(url, headers=headers).status_code == 403

    def test_voluntario_no_sube_documentos(self, client, auth_headers, storage, patient_ids):
        assert (
            self.upload(client, auth_headers("volunteer"), patient_ids["consent"]).status_code
            == 403
        )

    def test_rechaza_tipos_de_archivo_no_permitidos(
        self, client, auth_headers, storage, patient_ids
    ):
        response = self.upload(
            client, auth_headers(), patient_ids["consent"], b"MZ...", "application/x-msdownload"
        )

        assert response.status_code == 415
        assert storage.files == {}

    def test_rechaza_archivos_de_mas_de_10_mb(self, client, auth_headers, storage, patient_ids):
        response = self.upload(
            client, auth_headers(), patient_ids["consent"], b"0" * (10 * 1024 * 1024 + 1)
        )

        assert response.status_code == 413

    def test_documento_de_otro_paciente_no_se_expone(
        self, client, auth_headers, storage, patient_ids
    ):
        doc_id = self.upload(client, auth_headers(), patient_ids["consent"]).json()["id"]

        response = client.get(
            f"/api/v1/patients/{patient_ids['no_consent']}/documents/{doc_id}/url",
            headers=auth_headers(),
        )

        assert response.status_code == 404

    def test_falla_del_almacenamiento_no_guarda_metadata(
        self, client, auth_headers, storage, db_session, patient_ids
    ):
        storage.fail = True

        response = self.upload(client, auth_headers(), patient_ids["consent"])

        assert response.status_code == 502
        assert db_session.scalar(select(PatientDocument)) is None

    def test_solo_administrador_elimina_documentos(
        self, client, auth_headers, storage, patient_ids
    ):
        doc_id = self.upload(client, auth_headers(), patient_ids["consent"]).json()["id"]
        url = f"/api/v1/patients/{patient_ids['consent']}/documents/{doc_id}"

        assert client.delete(url, headers=auth_headers("professional")).status_code == 403
        assert client.delete(url, headers=auth_headers()).status_code == 200
        assert storage.files == {}

    def test_storage_caido_al_borrar_no_deja_metadata_huerfana(
        self, client, auth_headers, storage, db_session, patient_ids
    ):
        doc_id = self.upload(client, auth_headers(), patient_ids["consent"]).json()["id"]
        storage.fail = True

        response = client.delete(
            f"/api/v1/patients/{patient_ids['consent']}/documents/{doc_id}", headers=auth_headers()
        )

        # El borrado en la base se confirma; el archivo pendiente queda en el log para revisarlo
        assert response.status_code == 200
        assert db_session.get(PatientDocument, uuid.UUID(doc_id)) is None

    def test_sin_configuracion_de_storage_responde_503(self, client, auth_headers, patient_ids):
        response = self.upload(client, auth_headers(), patient_ids["consent"])

        assert response.status_code == 503
