"""Verificación del ID token de "Continuar con Google" (Google Identity Services).

El frontend recibe un ID token firmado por Google y lo envía a POST /auth/google. Aquí se
verifica la firma con las claves públicas de Google, que el token sea para nuestro
GOOGLE_CLIENT_ID, que no haya vencido y que lo haya emitido Google.
"""

from typing import Any, Protocol

import jwt

from app.core.config import settings
from app.core.errors import ServiceUnavailable, Unauthorized

GOOGLE_CERTS_URL = "https://www.googleapis.com/oauth2/v3/certs"
GOOGLE_ISSUERS = ("accounts.google.com", "https://accounts.google.com")
INVALID_TOKEN = "No pudimos verificar tu cuenta de Google. Intenta nuevamente."  # noqa: S105


class GoogleVerifier(Protocol):
    def verify(self, credential: str) -> dict[str, Any]: ...


class GoogleIdTokenVerifier:
    def __init__(self, client_id: str, jwks_client: Any | None = None) -> None:
        self.client_id = client_id
        self.jwks_client = jwks_client or jwt.PyJWKClient(GOOGLE_CERTS_URL, cache_keys=True)

    def verify(self, credential: str) -> dict[str, Any]:
        try:
            signing_key = self.jwks_client.get_signing_key_from_jwt(credential)
            claims = jwt.decode(
                credential,
                signing_key.key,
                algorithms=["RS256"],
                audience=self.client_id,
                options={"require": ["sub", "email", "iss", "exp", "aud"]},
            )
        except jwt.PyJWTError as exc:
            raise Unauthorized(INVALID_TOKEN) from exc
        if claims["iss"] not in GOOGLE_ISSUERS:
            raise Unauthorized(INVALID_TOKEN)
        return claims


def get_google_verifier() -> GoogleVerifier:
    if not settings.google_client_id:
        raise ServiceUnavailable("El inicio de sesión con Google no está configurado.")
    return GoogleIdTokenVerifier(settings.google_client_id)
