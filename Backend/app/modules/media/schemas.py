"""DTOs de la galería (camelCase)."""

import datetime as dt
import uuid
from typing import Literal

from pydantic import Field

from app.core.schemas import CamelModel

AssetKind = Literal["imagen", "video"]
Visibility = Literal["privado", "publico"]


class AlbumIn(CamelModel):
    title: str = Field(max_length=120)
    description: str = Field(default="", max_length=500)
    schedule_id: uuid.UUID | None = None


class AlbumUpdate(CamelModel):
    title: str | None = Field(default=None, max_length=120)
    description: str | None = Field(default=None, max_length=500)
    schedule_id: uuid.UUID | None = None


class AlbumPublish(CamelModel):
    # «Revisé que todas las personas que se reconocen dieron su permiso»
    permissions_reviewed: bool


class UploadSignatureOut(CamelModel):
    """Datos para subir un archivo directo a Cloudinary desde el navegador."""

    upload_url: str
    cloud_name: str
    api_key: str
    folder: str
    timestamp: int
    allowed_formats: str
    signature: str


class AssetIn(CamelModel):
    """Lo que devolvió Cloudinary al terminar la subida."""

    public_id: str = Field(max_length=255)
    url: str = Field(max_length=500)
    thumbnail_url: str | None = Field(default=None, max_length=500)
    kind: AssetKind
    width: int | None = Field(default=None, gt=0)
    height: int | None = Field(default=None, gt=0)
    size_bytes: int = Field(gt=0)


class TagsIn(CamelModel):
    patient_ids: list[uuid.UUID] = Field(max_length=50)


class TagOut(CamelModel):
    patient_id: uuid.UUID
    name: str
    # Sin «Uso de imagen: autorizado» en la ficha, la foto no se puede publicar
    image_consent: bool


class AssetOut(CamelModel):
    id: uuid.UUID
    kind: AssetKind
    url: str
    thumbnail_url: str | None
    width: int | None
    height: int | None
    size_bytes: int
    uploaded_at: dt.datetime
    tags: list[TagOut]


class AlbumSummaryOut(CamelModel):
    id: uuid.UUID
    title: str
    description: str
    visibility: Visibility
    permissions_reviewed: bool
    schedule_id: uuid.UUID | None
    asset_count: int
    cover_url: str | None
    created_at: dt.datetime


class PermissionWarning(CamelModel):
    asset_id: uuid.UUID
    patient_id: uuid.UUID
    name: str


class AlbumOut(AlbumSummaryOut):
    reviewed_at: dt.datetime | None
    assets: list[AssetOut]
    # Fotos con alguien sin permiso de imagen: bloquean la publicación
    warnings: list[PermissionWarning]


class PublicAssetOut(CamelModel):
    id: uuid.UUID
    kind: AssetKind
    url: str
    thumbnail_url: str | None
    width: int | None
    height: int | None


class PublicAlbumSummaryOut(CamelModel):
    id: uuid.UUID
    title: str
    description: str
    asset_count: int
    cover_url: str | None


class PublicAlbumOut(PublicAlbumSummaryOut):
    assets: list[PublicAssetOut]
