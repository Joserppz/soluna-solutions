"""Adaptadores de servicios externos: correo, Turnstile y Google (sin red)."""

import json
import time

import httpx
import jwt
import pytest
from cryptography.hazmat.primitives.asymmetric import rsa

from app.adapters.email import BrevoEmailSender, EmailMessage, ResendEmailSender
from app.adapters.google import GoogleIdTokenVerifier
from app.adapters.turnstile import CloudflareTurnstile
from app.core.config import Settings
from app.core.errors import Unauthorized

MESSAGE = EmailMessage(to="rosa@gmail.com", subject="Asunto", text="Hola")


def capture(status: int = 200, body: dict | None = None):
    seen: list[httpx.Request] = []

    def handler(request: httpx.Request) -> httpx.Response:
        seen.append(request)
        return httpx.Response(status, json=body or {})

    return seen, httpx.Client(transport=httpx.MockTransport(handler))


def test_resend_envia_el_correo_con_su_api_key():
    seen, client = capture()

    ResendEmailSender("re_clave", "ASPAR <hola@aspar.com>", client).send(MESSAGE)

    request = seen[0]
    assert request.url == "https://api.resend.com/emails"
    assert request.headers["Authorization"] == "Bearer re_clave"
    assert json.loads(request.content) == {
        "from": "ASPAR <hola@aspar.com>",
        "to": ["rosa@gmail.com"],
        "subject": "Asunto",
        "text": "Hola",
    }


def test_brevo_envia_el_correo_con_su_api_key():
    seen, client = capture()

    BrevoEmailSender("xkeysib", "ASPAR <hola@aspar.com>", client).send(MESSAGE)

    body = json.loads(seen[0].content)
    assert seen[0].headers["api-key"] == "xkeysib"
    assert body["sender"] == {"name": "ASPAR", "email": "hola@aspar.com"}
    assert body["to"] == [{"email": "rosa@gmail.com"}]


def test_error_del_proveedor_de_correo_se_propaga():
    _, client = capture(status=401)

    with pytest.raises(httpx.HTTPStatusError):
        ResendEmailSender("mala", "hola@aspar.com", client).send(MESSAGE)


@pytest.mark.parametrize(("body", "expected"), [({"success": True}, True), ({}, False)])
def test_turnstile_consulta_a_cloudflare(body, expected):
    seen, client = capture(body=body)

    assert CloudflareTurnstile("secreto", client).verify("token", "200.87.1.1") is expected
    assert b"remoteip=200.87.1.1" in seen[0].content


def test_turnstile_sin_token_no_consulta():
    seen, client = capture(body={"success": True})

    assert CloudflareTurnstile("secreto", client).verify("", None) is False
    assert seen == []


class FakeJwks:
    def __init__(self, key):
        self.key = key

    def get_signing_key_from_jwt(self, token):
        return type("SigningKey", (), {"key": self.key})()


@pytest.fixture
def google_keys():
    private = rsa.generate_private_key(public_exponent=65537, key_size=2048)
    return private, GoogleIdTokenVerifier("mi-client-id", FakeJwks(private.public_key()))


def google_token(private, **overrides):
    now = int(time.time())
    claims = {
        "iss": "https://accounts.google.com",
        "aud": "mi-client-id",
        "sub": "123",
        "email": "rosa@gmail.com",
        "email_verified": True,
        "iat": now,
        "exp": now + 300,
    }
    return jwt.encode(claims | overrides, private, algorithm="RS256")


def test_google_valida_firma_audiencia_y_emisor(google_keys):
    private, verifier = google_keys

    assert verifier.verify(google_token(private))["email"] == "rosa@gmail.com"
    for bad in (
        {"aud": "otra-app"},
        {"iss": "https://falso.com"},
        {"exp": int(time.time()) - 10},
    ):
        with pytest.raises(Unauthorized):
            verifier.verify(google_token(private, **bad))


def test_google_rechaza_tokens_firmados_por_otra_clave(google_keys):
    _, verifier = google_keys
    other = rsa.generate_private_key(public_exponent=65537, key_size=2048)

    with pytest.raises(Unauthorized):
        verifier.verify(google_token(other))


def test_produccion_no_arranca_con_configuracion_de_desarrollo():
    base = {"database_url": "postgresql://a:b@h/c", "jwt_secret": "x" * 40, "env": "prod"}

    with pytest.raises(ValueError, match="EMAIL_PROVIDER.*TURNSTILE"):
        Settings(_env_file=None, **base)
    ok = Settings(
        _env_file=None,
        **base,
        email_provider="resend",
        turnstile_secret_key="0x4AAA-clave-real",
    )
    assert ok.is_prod
