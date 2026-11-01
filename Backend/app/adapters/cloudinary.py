"""Firma de subidas directas a Cloudinary (galería, ADR-010).

El navegador sube el archivo directo a Cloudinary con una firma de un solo uso que
genera la API: la clave secreta nunca sale del servidor. Después, la API registra el
archivo solo si viene de nuestra cuenta y de la carpeta del álbum.
https://cloudinary.com/documentation/authentication_signatures
"""

import hashlib
import logging
import time
from typing import Protocol

import httpx

from app.core.config import settings
from app.core.errors import ServiceUnavailable

# Formatos de la galería (diseño pág. 13): JPG, PNG, WEBP o MP4
ALLOWED_FORMATS = "jpg,jpeg,png,webp,mp4"
RESOURCE_TYPES = {"imagen": "image", "video": "video"}

logger = logging.getLogger("aspar.cloudinary")


def signature(params: dict[str, str | int], api_secret: str) -> str:
    """SHA-1 de los parámetros ordenados («clave=valor» unidos con &) más el secreto."""
    to_sign = "&".join(f"{key}={params[key]}" for key in sorted(params))
    return hashlib.sha1((to_sign + api_secret).encode(), usedforsecurity=False).hexdigest()


class MediaSigner(Protocol):
    cloud_name: str

    def upload_params(self, folder: str) -> dict[str, str | int]: ...

    def owns(self, url: str) -> bool: ...

    def destroy(self, public_id: str, kind: str) -> None: ...


class CloudinarySigner:
    def __init__(
        self,
        cloud_name: str,
        api_key: str,
        api_secret: str,
        clock=time.time,
        client: httpx.Client | None = None,
    ):
        self.cloud_name = cloud_name
        self.api_key = api_key
        self._api_secret = api_secret
        self._clock = clock
        self._client = client or httpx.Client(timeout=15)

    def upload_params(self, folder: str) -> dict[str, str | int]:
        signed = {
            "allowed_formats": ALLOWED_FORMATS,
            "folder": folder,
            "timestamp": int(self._clock()),
        }
        return signed | {
            "signature": signature(signed, self._api_secret),
            "api_key": self.api_key,
            "cloud_name": self.cloud_name,
            "upload_url": f"https://api.cloudinary.com/v1_1/{self.cloud_name}/auto/upload",
        }

    def owns(self, url: str) -> bool:
        return url.startswith(f"https://res.cloudinary.com/{self.cloud_name}/")

    def destroy(self, public_id: str, kind: str) -> None:
        """Borra el archivo en Cloudinary (API «destroy», firmada). Lanza si Cloudinary falla."""
        signed = {"invalidate": "true", "public_id": public_id, "timestamp": int(self._clock())}
        resource = RESOURCE_TYPES[kind]
        response = self._client.post(
            f"https://api.cloudinary.com/v1_1/{self.cloud_name}/{resource}/destroy",
            data=signed
            | {"signature": signature(signed, self._api_secret), "api_key": self.api_key},
        )
        response.raise_for_status()
        result = response.json().get("result")
        if result not in ("ok", "not found"):
            raise RuntimeError(f"Cloudinary no borró {public_id}: {result}")


def get_optional_media_signer() -> MediaSigner | None:
    """El firmador de Cloudinary, o None si no está configurado."""
    secret = settings.cloudinary_api_secret.get_secret_value()
    if not (settings.cloudinary_cloud_name and settings.cloudinary_api_key and secret):
        return None
    return CloudinarySigner(settings.cloudinary_cloud_name, settings.cloudinary_api_key, secret)


def get_media_signer() -> MediaSigner:
    signer = get_optional_media_signer()
    if signer is None:
        raise ServiceUnavailable("La subida de fotos y videos no está configurada (Cloudinary).")
    return signer
