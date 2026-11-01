"""Galería (diseño pág. 13): álbumes, subida firmada a Cloudinary y permisos de imagen."""

import hashlib

import pytest
from sqlalchemy import select

from app.adapters.cloudinary import CloudinarySigner, signature
from app.models import AuditLog, MediaAlbum
from tests.conftest import requires_db

URL = "/api/v1/media"
PUBLIC = "/api/v1/public/media"


def test_firma_igual_al_ejemplo_de_la_documentacion_de_cloudinary():
    params = {
        "eager": "w_400,h_300,c_pad|w_260,h_200,c_crop",
        "public_id": "sample_image",
        "timestamp": 1315060510,
    }

    assert signature(params, "abcd") == "bfd09f95f331f558cbd1320e67aa8d488770583e"


def test_borrar_en_cloudinary_con_la_api_destroy_firmada():
    import httpx

    sent = []

    def cloudinary(request):
        sent.append(request)
        return httpx.Response(200, json={"result": "ok"})

    signer = CloudinarySigner(
        "aspar",
        "1234",
        "secreto",
        clock=lambda: 1700000000,
        client=httpx.Client(transport=httpx.MockTransport(cloudinary)),
    )

    signer.destroy("aspar/albums/a/foto", "imagen")

    request = sent[0]
    assert str(request.url) == "https://api.cloudinary.com/v1_1/aspar/image/destroy"
    form = dict(pair.split("=", 1) for pair in request.content.decode().split("&"))
    expected = signature(
        {"invalidate": "true", "public_id": "aspar/albums/a/foto", "timestamp": 1700000000},
        "secreto",
    )
    assert form["signature"] == expected and form["api_key"] == "1234"
    assert "secreto" not in request.content.decode()


@pytest.mark.parametrize(
    ("response", "kind"),
    [({"result": "error"}, "video"), ({"error": {"message": "Invalid Signature"}}, "imagen")],
)
def test_cloudinary_que_no_borra_lanza_error(response, kind):
    import httpx

    status = 401 if "error" in response else 200
    signer = CloudinarySigner(
        "aspar",
        "1234",
        "secreto",
        client=httpx.Client(
            transport=httpx.MockTransport(lambda r: httpx.Response(status, json=response))
        ),
    )

    with pytest.raises((RuntimeError, httpx.HTTPStatusError)):
        signer.destroy("aspar/albums/a/clip", kind)


def test_parametros_de_subida_firmados_sin_exponer_el_secreto():
    signer = CloudinarySigner("aspar", "1234", "secreto", clock=lambda: 1700000000)

    params = signer.upload_params("aspar/albums/x")

    # Cloudinary firma con SHA-1 (es su algoritmo, no una elección nuestra)
    expected = hashlib.sha1(
        b"allowed_formats=jpg,jpeg,png,webp,mp4&folder=aspar/albums/x&timestamp=1700000000secreto",
        usedforsecurity=False,
    ).hexdigest()
    assert params["signature"] == expected
    assert params["upload_url"] == "https://api.cloudinary.com/v1_1/aspar/auto/upload"
    assert "secreto" not in str(params)
    assert signer.owns("https://res.cloudinary.com/aspar/image/upload/a.jpg")
    assert not signer.owns("https://res.cloudinary.com/otra/image/upload/a.jpg")


class RecordingSigner(CloudinarySigner):
    """Firma de verdad, pero anota los borrados en vez de llamar a Cloudinary."""

    def __init__(self):
        super().__init__("aspar-demo", "1234", "secreto", clock=lambda: 1700000000)
        self.destroyed: list[tuple[str, str]] = []

    def destroy(self, public_id: str, kind: str) -> None:
        self.destroyed.append((public_id, kind))


@pytest.fixture
def signer(client):
    from app.adapters.cloudinary import get_media_signer, get_optional_media_signer
    from app.main import app

    fake = RecordingSigner()
    app.dependency_overrides[get_media_signer] = lambda: fake
    app.dependency_overrides[get_optional_media_signer] = lambda: fake
    return fake


def albums(db_session):
    return {a.title: a for a in db_session.scalars(select(MediaAlbum))}


def asset_payload(album_id, name="foto1", **changes):
    return {
        "publicId": f"aspar/albums/{album_id}/{name}",
        "url": f"https://res.cloudinary.com/aspar-demo/image/upload/{name}.jpg",
        "kind": "imagen",
        "width": 1200,
        "height": 800,
        "sizeBytes": 300000,
    } | changes


@requires_db
class TestAlbumes:
    def test_listar_y_ver_un_album_con_advertencias(self, client, auth_headers, db_session):
        headers = auth_headers("coordination")
        review = albums(db_session)["Crear con las manos"]

        listed = client.get(f"{URL}/albums", headers=headers).json()
        detail = client.get(f"{URL}/albums/{review.id}", headers=headers).json()
        published_only = client.get(
            f"{URL}/albums", params={"visibility": "publico"}, headers=headers
        ).json()

        assert {a["title"] for a in listed} == {"Crear con las manos", "Encontrarnos en movimiento"}
        assert [a["title"] for a in published_only] == ["Encontrarnos en movimiento"]
        assert detail["visibility"] == "privado" and detail["assetCount"] == 1
        tags = {t["name"]: t["imageConsent"] for t in detail["assets"][0]["tags"]}
        assert tags == {"Elena Rojas": True, "Miguel Fernández": False}
        assert [w["name"] for w in detail["warnings"]] == ["Miguel Fernández"]

    def test_crear_editar_y_eliminar_un_album(self, client, auth_headers):
        headers = auth_headers("coordination")
        album = client.post(
            f"{URL}/albums", json={"title": "Teatro de octubre"}, headers=headers
        ).json()

        edited = client.patch(
            f"{URL}/albums/{album['id']}", json={"description": "Ensayo general"}, headers=headers
        )
        short = client.post(f"{URL}/albums", json={"title": "Te"}, headers=headers)
        deleted = client.delete(f"{URL}/albums/{album['id']}", headers=headers)

        assert edited.json()["description"] == "Ensayo general"
        assert short.status_code == 422
        assert deleted.status_code == 200
        assert client.get(f"{URL}/albums/{album['id']}", headers=headers).status_code == 404

    def test_permisos(self, client, auth_headers):
        assert client.get(f"{URL}/albums", headers=auth_headers("reception")).status_code == 403
        assert client.get(f"{URL}/albums", headers=auth_headers("volunteer")).status_code == 403


@requires_db
class TestSubida:
    def test_firma_para_subir_al_album(self, client, auth_headers, db_session, signer):
        review = albums(db_session)["Crear con las manos"]

        body = client.post(
            f"{URL}/albums/{review.id}/upload-signature", headers=auth_headers("coordination")
        ).json()

        assert body["folder"] == f"aspar/albums/{review.id}"
        assert (body["cloudName"], body["apiKey"], body["timestamp"]) == (
            "aspar-demo",
            "1234",
            1700000000,
        )
        assert len(body["signature"]) == 40

    def test_sin_cloudinary_configurado_responde_503(self, client, auth_headers, db_session):
        review = albums(db_session)["Crear con las manos"]

        response = client.post(
            f"{URL}/albums/{review.id}/upload-signature", headers=auth_headers("coordination")
        )

        assert response.status_code == 503

    def test_registrar_un_archivo_subido(self, client, auth_headers, db_session, signer):
        review = albums(db_session)["Crear con las manos"]

        response = client.post(
            f"{URL}/albums/{review.id}/assets",
            json=asset_payload(review.id),
            headers=auth_headers("coordination"),
        )

        assert response.status_code == 201, response.text
        assert response.json()["tags"] == []

    @pytest.mark.parametrize(
        ("changes", "status", "message"),
        [
            ({"publicId": "otra/carpeta/foto"}, 422, "carpeta de este álbum"),
            (
                {"url": "https://res.cloudinary.com/otra-cuenta/image/upload/a.jpg"},
                422,
                "Cloudinary de ASPAR",
            ),
            ({"url": "https://evil.com/a.jpg"}, 422, "Cloudinary de ASPAR"),
            ({"sizeBytes": 11 * 1024 * 1024}, 422, "10 MB"),
            ({"kind": "pdf"}, 422, None),
        ],
    )
    def test_archivos_rechazados(
        self, client, auth_headers, db_session, signer, changes, status, message
    ):
        review = albums(db_session)["Crear con las manos"]

        response = client.post(
            f"{URL}/albums/{review.id}/assets",
            json=asset_payload(review.id) | changes,
            headers=auth_headers("coordination"),
        )

        assert response.status_code == status
        if message:
            assert message in response.json()["detail"]

    def test_el_mismo_archivo_no_se_registra_dos_veces(
        self, client, auth_headers, db_session, signer
    ):
        headers = auth_headers("coordination")
        review = albums(db_session)["Crear con las manos"]
        client.post(
            f"{URL}/albums/{review.id}/assets", json=asset_payload(review.id), headers=headers
        )

        again = client.post(
            f"{URL}/albums/{review.id}/assets", json=asset_payload(review.id), headers=headers
        )

        assert again.status_code == 409


@requires_db
class TestPublicar:
    def test_no_se_publica_sin_la_revision_ni_con_advertencias(
        self, client, auth_headers, db_session
    ):
        headers = auth_headers("coordination")
        review = albums(db_session)["Crear con las manos"]

        unchecked = client.post(
            f"{URL}/albums/{review.id}/publish",
            json={"permissionsReviewed": False},
            headers=headers,
        )
        warned = client.post(
            f"{URL}/albums/{review.id}/publish", json={"permissionsReviewed": True}, headers=headers
        )

        assert unchecked.status_code == 422 and "Revisé que todas" in unchecked.json()["detail"]
        assert warned.status_code == 409
        assert "1 foto(s) aparece una persona sin permiso de imagen" in warned.json()["detail"]

    def test_quitar_la_etiqueta_permite_publicar(
        self, client, auth_headers, db_session, patient_ids
    ):
        headers = auth_headers("coordination")
        review = albums(db_session)["Crear con las manos"]
        asset_id = review.assets[0].id

        tagged = client.put(
            f"{URL}/assets/{asset_id}/tags",
            json={"patientIds": [str(patient_ids["consent"])]},
            headers=headers,
        )
        published = client.post(
            f"{URL}/albums/{review.id}/publish", json={"permissionsReviewed": True}, headers=headers
        )

        assert [t["name"] for t in tagged.json()["tags"]] == ["Elena Rojas"]
        assert published.status_code == 200, published.text
        body = published.json()
        assert (body["visibility"], body["permissionsReviewed"], body["warnings"]) == (
            "publico",
            True,
            [],
        )
        assert db_session.scalar(select(AuditLog).where(AuditLog.action == "Publicación de álbum"))
        public = client.get(f"{PUBLIC}/albums").json()
        assert "Crear con las manos" in {a["title"] for a in public}

    def test_un_cambio_en_un_album_publicado_lo_devuelve_a_revision(
        self, client, auth_headers, db_session, signer, patient_ids
    ):
        headers = auth_headers("coordination")
        published = albums(db_session)["Encontrarnos en movimiento"]

        added = client.post(
            f"{URL}/albums/{published.id}/assets",
            json=asset_payload(published.id, "nueva"),
            headers=headers,
        )
        detail = client.get(f"{URL}/albums/{published.id}", headers=headers).json()

        assert added.status_code == 201
        assert (detail["visibility"], detail["permissionsReviewed"]) == ("privado", False)
        assert "Encontrarnos en movimiento" not in {
            a["title"] for a in client.get(f"{PUBLIC}/albums").json()
        }

    def test_etiquetar_a_alguien_sin_permiso_en_un_album_publicado(
        self, client, auth_headers, db_session, patient_ids
    ):
        headers = auth_headers("coordination")
        published = albums(db_session)["Encontrarnos en movimiento"]

        response = client.put(
            f"{URL}/assets/{published.assets[0].id}/tags",
            json={"patientIds": [str(patient_ids["no_consent"])]},
            headers=headers,
        )

        assert response.json()["tags"][0]["imageConsent"] is False
        detail = client.get(f"{URL}/albums/{published.id}", headers=headers).json()
        assert detail["visibility"] == "privado"
        assert [w["name"] for w in detail["warnings"]] == ["Miguel Fernández"]

    def test_quitar_del_sitio_y_no_eliminar_publicados(self, client, auth_headers, db_session):
        headers = auth_headers("coordination")
        published = albums(db_session)["Encontrarnos en movimiento"]

        blocked = client.delete(f"{URL}/albums/{published.id}", headers=headers)
        removed = client.post(f"{URL}/albums/{published.id}/unpublish", headers=headers)

        assert blocked.status_code == 409
        assert removed.json()["visibility"] == "privado"
        assert (
            client.post(f"{URL}/albums/{published.id}/unpublish", headers=headers).status_code
            == 409
        )

    def test_etiquetar_a_alguien_sin_ficha(self, client, auth_headers, db_session):
        import uuid

        review = albums(db_session)["Crear con las manos"]
        response = client.put(
            f"{URL}/assets/{review.assets[0].id}/tags",
            json={"patientIds": [str(uuid.uuid4())]},
            headers=auth_headers("coordination"),
        )

        assert response.status_code == 404


@requires_db
class TestGaleriaPublica:
    def test_solo_albumes_publicados_y_sin_etiquetas(self, client, db_session):
        client.cookies.clear()
        listed = client.get(f"{PUBLIC}/albums").json()
        published = albums(db_session)["Encontrarnos en movimiento"]
        detail = client.get(f"{PUBLIC}/albums/{published.id}").json()
        review = albums(db_session)["Crear con las manos"]

        assert [a["title"] for a in listed] == ["Encontrarnos en movimiento"]
        assert listed[0]["assetCount"] == 2 and listed[0]["coverUrl"]
        assert len(detail["assets"]) == 2
        assert "tags" not in detail["assets"][0]
        assert client.get(f"{PUBLIC}/albums/{review.id}").status_code == 404

    def test_quitar_un_archivo_sin_cloudinary_configurado(self, client, auth_headers, db_session):
        headers = auth_headers("coordination")
        published = albums(db_session)["Encontrarnos en movimiento"]

        response = client.delete(f"{URL}/assets/{published.assets[0].id}", headers=headers)

        assert response.status_code == 200
        assert client.get(f"{URL}/albums/{published.id}", headers=headers).json()["assetCount"] == 1


@requires_db
class TestBorradoEnCloudinary:
    def test_quitar_un_archivo_lo_borra_en_cloudinary(
        self, client, auth_headers, db_session, signer
    ):
        headers = auth_headers("coordination")
        review = albums(db_session)["Crear con las manos"]
        asset = client.post(
            f"{URL}/albums/{review.id}/assets",
            json=asset_payload(review.id, "borrar"),
            headers=headers,
        ).json()

        response = client.delete(f"{URL}/assets/{asset['id']}", headers=headers)

        assert response.status_code == 200
        assert signer.destroyed == [(f"aspar/albums/{review.id}/borrar", "imagen")]

    def test_no_borra_archivos_de_otra_cuenta(self, client, auth_headers, db_session, signer):
        published = albums(db_session)["Encontrarnos en movimiento"]

        client.delete(
            f"{URL}/assets/{published.assets[0].id}", headers=auth_headers("coordination")
        )

        # Las fotos de demostración están en la cuenta pública «demo» de Cloudinary
        assert signer.destroyed == []

    def test_eliminar_un_album_borra_todos_sus_archivos(
        self, client, auth_headers, db_session, signer
    ):
        headers = auth_headers("coordination")
        album = client.post(f"{URL}/albums", json={"title": "Para borrar"}, headers=headers).json()
        for name in ("a", "b"):
            client.post(
                f"{URL}/albums/{album['id']}/assets",
                json=asset_payload(album["id"], name),
                headers=headers,
            )

        client.delete(f"{URL}/albums/{album['id']}", headers=headers)

        assert sorted(signer.destroyed) == [
            (f"aspar/albums/{album['id']}/a", "imagen"),
            (f"aspar/albums/{album['id']}/b", "imagen"),
        ]

    def test_si_la_transaccion_se_revierte_cloudinary_no_borra(
        self, client, auth_headers, db_session, signer, monkeypatch
    ):
        from app.core.errors import Conflict
        from app.modules.media import service as media_service

        headers = auth_headers("coordination")
        review = albums(db_session)["Crear con las manos"]
        asset = client.post(
            f"{URL}/albums/{review.id}/assets",
            json=asset_payload(review.id, "queda"),
            headers=headers,
        ).json()

        def failing_audit(*args, **kwargs):
            # Falla después de programar el borrado remoto: la base revierte el cambio
            raise Conflict("Falla simulada al guardar")

        monkeypatch.setattr(media_service, "_audit", failing_audit)
        response = client.delete(f"{URL}/assets/{asset['id']}", headers=headers)

        assert response.status_code == 409
        assert signer.destroyed == []
        ids = [
            a["id"]
            for a in client.get(f"{URL}/albums/{review.id}", headers=headers).json()["assets"]
        ]
        assert asset["id"] in ids

    def test_si_cloudinary_falla_el_archivo_igual_se_quita_de_la_galeria(
        self, client, auth_headers, db_session, signer, monkeypatch
    ):
        headers = auth_headers("coordination")
        review = albums(db_session)["Crear con las manos"]
        asset = client.post(
            f"{URL}/albums/{review.id}/assets",
            json=asset_payload(review.id, "falla"),
            headers=headers,
        ).json()

        def broken(public_id, kind):
            raise RuntimeError("Cloudinary caído")

        monkeypatch.setattr(signer, "destroy", broken)
        response = client.delete(f"{URL}/assets/{asset['id']}", headers=headers)

        assert response.status_code == 200
        ids = [
            a["id"]
            for a in client.get(f"{URL}/albums/{review.id}", headers=headers).json()["assets"]
        ]
        assert asset["id"] not in ids

    def test_registro_simultaneo_del_mismo_archivo_es_409(
        self, client, auth_headers, db_session, signer, monkeypatch
    ):
        from app.modules.media import repository as media_repository

        headers = auth_headers("coordination")
        review = albums(db_session)["Crear con las manos"]
        client.post(
            f"{URL}/albums/{review.id}/assets",
            json=asset_payload(review.id, "doble"),
            headers=headers,
        )
        # Simula a otra persona registrando el mismo archivo entre la revisión y el guardado
        monkeypatch.setattr(media_repository, "asset_by_public_id", lambda db, public_id: None)

        response = client.post(
            f"{URL}/albums/{review.id}/assets",
            json=asset_payload(review.id, "doble"),
            headers=headers,
        )

        assert response.status_code == 409
        assert response.json()["detail"] == "Ese archivo ya está registrado en la galería."
