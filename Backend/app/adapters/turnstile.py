"""Cloudflare Turnstile: verifica que un formulario público lo envió una persona.

En desarrollo se usa la clave secreta de prueba de Cloudflare, que siempre aprueba
(https://developers.cloudflare.com/turnstile/troubleshooting/testing/).
"""

from typing import Protocol

import httpx

from app.core.config import settings

VERIFY_URL = "https://challenges.cloudflare.com/turnstile/v0/siteverify"


class TurnstileVerifier(Protocol):
    def verify(self, token: str, ip: str | None) -> bool: ...


class CloudflareTurnstile:
    def __init__(self, secret: str, client: httpx.Client | None = None) -> None:
        self.secret = secret
        self.client = client or httpx.Client(timeout=10)

    def verify(self, token: str, ip: str | None) -> bool:
        if not token:
            return False
        data = {"secret": self.secret, "response": token}
        if ip:
            data["remoteip"] = ip
        try:
            response = self.client.post(VERIFY_URL, data=data)
            response.raise_for_status()
        except httpx.HTTPError:
            return False
        return bool(response.json().get("success"))


def get_turnstile() -> TurnstileVerifier:
    return CloudflareTurnstile(settings.turnstile_secret_key.get_secret_value())
