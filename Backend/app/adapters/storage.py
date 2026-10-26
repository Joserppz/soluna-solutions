"""Adaptador de Supabase Storage para archivos privados (componente Adapters del C3)."""

from typing import Protocol
from urllib.parse import quote

import httpx
from fastapi import HTTPException, status

from app.core.config import (
    PATIENT_DOCUMENTS_BUCKET,
    SUPABASE_SERVICE_ROLE_KEY,
    SUPABASE_URL,
)


class PrivateStorage(Protocol):
    def upload(self, path: str, content: bytes, content_type: str) -> None: ...

    def signed_url(self, path: str, expires_in: int) -> str: ...

    def delete(self, path: str) -> None: ...


class SupabaseStorage:
    """Cliente REST de Supabase Storage autenticado con la service role key.

    La service role key solo vive en el .env del Backend: nunca se envía al frontend.
    """

    def __init__(
        self, base_url: str, service_key: str, bucket: str, client: httpx.Client | None = None
    ) -> None:
        self.base_url = f"{base_url}/storage/v1"
        self.bucket = bucket
        self.client = client or httpx.Client(timeout=30)
        self.headers = {"Authorization": f"Bearer {service_key}", "apikey": service_key}

    def _object_url(self, action: str, path: str) -> str:
        return f"{self.base_url}/{action}/{self.bucket}/{quote(path)}"

    def upload(self, path: str, content: bytes, content_type: str) -> None:
        response = self.client.post(
            self._object_url("object", path),
            content=content,
            headers=self.headers | {"Content-Type": content_type, "x-upsert": "false"},
        )
        response.raise_for_status()

    def signed_url(self, path: str, expires_in: int) -> str:
        response = self.client.post(
            self._object_url("object/sign", path),
            json={"expiresIn": expires_in},
            headers=self.headers,
        )
        response.raise_for_status()
        return f"{self.base_url}{response.json()['signedURL']}"

    def delete(self, path: str) -> None:
        response = self.client.delete(self._object_url("object", path), headers=self.headers)
        response.raise_for_status()


def get_private_storage() -> PrivateStorage:
    if not SUPABASE_URL or not SUPABASE_SERVICE_ROLE_KEY:
        raise HTTPException(
            status.HTTP_503_SERVICE_UNAVAILABLE,
            "El almacenamiento de documentos no está configurado "
            "(SUPABASE_URL y SUPABASE_SERVICE_ROLE_KEY).",
        )
    return SupabaseStorage(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, PATIENT_DOCUMENTS_BUCKET)
