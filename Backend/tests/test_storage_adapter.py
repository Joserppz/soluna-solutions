import json

import httpx
import pytest

from app.adapters.storage import SupabaseStorage


def make_storage(handler):
    client = httpx.Client(transport=httpx.MockTransport(handler))
    return SupabaseStorage("https://abc.supabase.co", "service-key", "documentos-pacientes", client)


def test_upload_usa_bucket_privado_y_service_key():
    seen = {}

    def handler(request):
        seen.update(
            url=str(request.url),
            auth=request.headers["authorization"],
            apikey=request.headers["apikey"],
            type=request.headers["content-type"],
            body=request.content,
        )
        return httpx.Response(200, json={"Key": "ok"})

    make_storage(handler).upload("p-1/doc.pdf", b"%PDF", "application/pdf")

    assert (
        seen["url"] == "https://abc.supabase.co/storage/v1/object/documentos-pacientes/p-1/doc.pdf"
    )
    assert seen["auth"] == "Bearer service-key"
    assert seen["apikey"] == "service-key"
    assert seen["type"] == "application/pdf"
    assert seen["body"] == b"%PDF"


def test_signed_url_devuelve_url_absoluta_con_expiracion():
    def handler(request):
        assert request.url.path == "/storage/v1/object/sign/documentos-pacientes/p-1/doc.pdf"
        assert json.loads(request.content) == {"expiresIn": 300}
        return httpx.Response(
            200, json={"signedURL": "/object/sign/documentos-pacientes/p-1/doc.pdf?token=t"}
        )

    url = make_storage(handler).signed_url("p-1/doc.pdf", 300)

    assert url == (
        "https://abc.supabase.co/storage/v1/object/sign/documentos-pacientes/p-1/doc.pdf?token=t"
    )


def test_error_del_storage_se_propaga():
    storage = make_storage(lambda request: httpx.Response(403, json={"error": "denied"}))

    with pytest.raises(httpx.HTTPStatusError):
        storage.delete("p-1/doc.pdf")
