"""Firma de subidas directas a Cloudinary (galería, ADR-010).

El navegador sube el archivo directo a Cloudinary con una firma de un solo uso que
genera la API: la clave secreta nunca sale del servidor. Después, la API registra el
archivo solo si viene de nuestra cuenta y de la carpeta del álbum.
https://cloudinary.com/documentation/authentication_signatures
"""

import hashlib
import time
from typing import Protocol

from app.core.config import settings
from app.core.errors import ServiceUnavailable

# Formatos de la galería (diseño pág. 13): JPG, PNG, WEBP o MP4
ALLOWED_FORMATS = "jpg,jpeg,png,webp,mp4"


def signature(params: dict[str, str | int], api_secret: str) -> str:
    """SHA-1 de los parámetros ordenados («clave=valor» unidos con &) más el secreto."""
    to_sign = "&".join(f"{key}={params[key]}" for key in sorted(params))
    return hashlib.sha1((to_sign + api_secret).encode(), usedforsecurity=False).hexdigest()


class MediaSigner(Protocol):
    cloud_name: str

    def upload_params(self, folder: str) -> dict[str, str | int]: ...

    def owns(self, url: str) -> bool: ...


class CloudinarySigner:
    def __init__(self, cloud_name: str, api_key: str, api_secret: str, clock=time.time):
        self.cloud_name = cloud_name
        self.api_key = api_key
        self._api_secret = api_secret
        self._clock = clock

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


def get_media_signer() -> MediaSigner:
    secret = settings.cloudinary_api_secret.get_secret_value()
    if not (settings.cloudinary_cloud_name and settings.cloudinary_api_key and secret):
        raise ServiceUnavailable("La subida de fotos y videos no está configurada (Cloudinary).")
    return CloudinarySigner(settings.cloudinary_cloud_name, settings.cloudinary_api_key, secret)
