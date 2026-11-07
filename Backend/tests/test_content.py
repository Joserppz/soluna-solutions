"""Contenido del sitio (diseño pág. 14): borrador, publicación y redes sociales."""

import pytest
from sqlalchemy import select

from app.models import AuditLog
from tests.conftest import requires_db

pytestmark = requires_db

URL = "/api/v1/content"
PUBLIC = "/api/v1/public/content"


def section(client, headers, key):
    return client.get(f"{URL}/sections/{key}", headers=headers).json()


def test_las_siete_secciones_en_orden(client, auth_headers):
    body = client.get(f"{URL}/sections", headers=auth_headers("coordination")).json()

    assert [s["key"] for s in body] == [
        "presentacion",
        "mision_vision",
        "historia",
        "como_participar",
        "preguntas_frecuentes",
        "donaciones",
        "redes_contacto",
    ]
    mision = body[1]
    assert mision["publishedContent"]["mision"].startswith("Acompañar")
    assert mision["hasUnpublishedChanges"] is False
    assert body[2]["publishedContent"] is None


def test_guardar_borrador_no_cambia_el_sitio(client, auth_headers):
    headers = auth_headers("coordination")
    draft = {
        "titulo": "Acompañar también es hacer lugar.",
        "mision": "Nueva misión.",
        "vision": "Visión.",
    }

    saved = client.put(f"{URL}/sections/mision_vision", json={"content": draft}, headers=headers)

    assert saved.status_code == 200, saved.text
    assert saved.json()["hasUnpublishedChanges"] is True
    assert saved.json()["draftUpdatedAt"]
    public = client.get(f"{PUBLIC}/mision_vision").json()
    assert public["content"]["mision"].startswith("Acompañar a personas")


def test_publicar_cambios(client, auth_headers, db_session):
    headers = auth_headers("coordination")
    content = {
        "titulo": "Nuestra historia",
        "texto": "ASPAR nació en La Paz de la mano de familias que buscaban acompañarse.",
    }
    client.put(f"{URL}/sections/historia", json={"content": content}, headers=headers)

    published = client.post(f"{URL}/sections/historia/publish", headers=headers)
    again = client.post(f"{URL}/sections/historia/publish", headers=headers)

    assert published.status_code == 200
    assert published.json()["hasUnpublishedChanges"] is False
    assert again.status_code == 409
    public = client.get(f"{PUBLIC}/historia").json()
    assert public["content"]["texto"].startswith("ASPAR nació")
    assert "historia" in {s["key"] for s in client.get(PUBLIC).json()}
    log = db_session.scalar(
        select(AuditLog).where(AuditLog.action == "Publicación de contenido en el sitio")
    )
    assert log.category == "CONTENIDO"


def test_preguntas_frecuentes_y_pasos(client, auth_headers):
    headers = auth_headers("coordination")

    faq = client.put(
        f"{URL}/sections/preguntas_frecuentes",
        json={
            "content": {
                "preguntas": [{"pregunta": "¿Tiene costo?", "respuesta": "No, es gratuito."}]
            }
        },
        headers=headers,
    )
    steps = client.put(
        f"{URL}/sections/como_participar",
        json={"content": {"pasos": ["Conversamos", "Preparamos tu registro"]}},
        headers=headers,
    )

    assert faq.json()["draftContent"]["preguntas"][0]["respuesta"] == "No, es gratuito."
    assert steps.json()["draftContent"]["pasos"] == ["Conversamos", "Preparamos tu registro"]


@pytest.mark.parametrize(
    ("key", "content", "message"),
    [
        ("mision_vision", {"mision": "x" * 1501}, "mision"),
        ("mision_vision", {"campoInventado": "x"}, "campoInventado"),
        ("donaciones", {"qrUrl": "http://inseguro.com/qr.png"}, "https://"),
        ("redes_contacto", {"whatsapp": "+591 7000"}, "solo dígitos"),
        ("preguntas_frecuentes", {"preguntas": [{"pregunta": "¿?"}]}, "preguntas"),
    ],
)
def test_validaciones_por_seccion(client, auth_headers, key, content, message):
    response = client.put(
        f"{URL}/sections/{key}", json={"content": content}, headers=auth_headers("coordination")
    )

    assert response.status_code == 422
    assert message in response.json()["detail"]


def test_seccion_inexistente_o_sin_publicar(client, auth_headers):
    assert client.get(f"{URL}/sections/precios", headers=auth_headers()).status_code == 404
    assert client.get(f"{PUBLIC}/historia").status_code == 404
    empty = client.post(f"{URL}/sections/historia/publish", headers=auth_headers())
    assert empty.status_code == 409


class TestRedesSociales:
    def test_guardar_enlaces_los_publica_sin_tocar_el_resto(self, client, auth_headers):
        headers = auth_headers("coordination")
        client.put(
            f"{URL}/sections/redes_contacto",
            json={"content": {"telefono": "2 2412345"}},
            headers=headers,
        )

        saved = client.put(
            f"{URL}/social-links",
            json={"facebook": "https://www.facebook.com/aspar.bo", "instagram": "", "tiktok": ""},
            headers=headers,
        )

        assert saved.status_code == 200, saved.text
        public = client.get(f"{PUBLIC}/redes_contacto").json()["content"]
        assert public["facebook"] == "https://www.facebook.com/aspar.bo"
        assert public["instagram"] == ""
        # El teléfono sigue en borrador hasta publicar la sección
        assert public["telefono"] == ""
        assert saved.json()["draftContent"]["telefono"] == "2 2412345"

    @pytest.mark.parametrize(
        "links",
        [
            {"facebook": "https://notfacebook.com/aspar"},
            {"instagram": "http://instagram.com/aspar"},
            {"tiktok": "https://www.tiktok.com.evil.io/@aspar"},
        ],
    )
    def test_solo_enlaces_oficiales(self, client, auth_headers, links):
        response = client.put(
            f"{URL}/social-links", json=links, headers=auth_headers("coordination")
        )

        assert response.status_code == 422
        assert "enlace oficial" in response.json()["detail"]


def test_permisos_y_sitio_sin_sesion(client, auth_headers):
    assert client.get(f"{URL}/sections", headers=auth_headers("reception")).status_code == 403
    client.cookies.clear()
    public = client.get(PUBLIC).json()
    assert {s["key"] for s in public} == {"presentacion", "mision_vision", "redes_contacto"}
    assert "draftContent" not in public[0]
