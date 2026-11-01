import uuid

from fastapi import APIRouter, Depends, status

from app.adapters.cloudinary import MediaSigner, get_media_signer, get_optional_media_signer
from app.core.database import DbSession
from app.core.schemas import MessageResponse
from app.modules.auth.dependencies import CurrentUser, require_permission
from app.modules.media import repository as media_repository
from app.modules.media import service as media_service
from app.modules.media.models import MediaAlbum, MediaAsset
from app.modules.media.schemas import (
    AlbumIn,
    AlbumOut,
    AlbumPublish,
    AlbumSummaryOut,
    AlbumUpdate,
    AssetIn,
    AssetOut,
    PermissionWarning,
    PublicAlbumOut,
    PublicAlbumSummaryOut,
    PublicAssetOut,
    TagOut,
    TagsIn,
    UploadSignatureOut,
    Visibility,
)
from app.modules.users.models import MEDIA_MANAGE

router = APIRouter(prefix="/api/v1/media", tags=["Galería y contenido"])
public_router = APIRouter(prefix="/api/v1/public/media", tags=["Sitio público"])

managers = require_permission(MEDIA_MANAGE)


def _cover(album: MediaAlbum) -> str | None:
    first = album.assets[0] if album.assets else None
    return (first.thumbnail_url or first.url) if first else None


def _summary_fields(album: MediaAlbum) -> dict:
    return {
        "id": album.id,
        "title": album.title,
        "description": album.description,
        "visibility": album.visibility,
        "permissions_reviewed": album.permissions_reviewed,
        "schedule_id": album.schedule_id,
        "asset_count": len(album.assets),
        "cover_url": _cover(album),
        "created_at": album.created_at,
    }


def _asset_out(asset: MediaAsset, people) -> AssetOut:
    return AssetOut(
        id=asset.id,
        kind=asset.kind,
        url=asset.url,
        thumbnail_url=asset.thumbnail_url,
        width=asset.width,
        height=asset.height,
        size_bytes=asset.size_bytes,
        uploaded_at=asset.uploaded_at,
        tags=[
            TagOut(
                patient_id=tag.patient_id,
                name=people[tag.patient_id].name,
                image_consent=people[tag.patient_id].image_consent,
            )
            for tag in asset.tags
        ],
    )


def _album_out(db: DbSession, album: MediaAlbum) -> AlbumOut:
    people = media_service.tagged_patients(db, album)
    return AlbumOut(
        **_summary_fields(album),
        reviewed_at=album.reviewed_at,
        assets=[_asset_out(asset, people) for asset in album.assets],
        warnings=[
            PermissionWarning(asset_id=asset.id, patient_id=patient.id, name=patient.name)
            for asset, patient in media_service.warnings(album, people)
        ],
    )


@router.get("/albums", response_model=list[AlbumSummaryOut], response_model_by_alias=True)
def list_albums(
    db: DbSession, visibility: Visibility | None = None, current: CurrentUser = Depends(managers)
):
    return [
        AlbumSummaryOut(**_summary_fields(album))
        for album in media_repository.list_albums(db, visibility)
    ]


@router.post(
    "/albums",
    response_model=AlbumOut,
    response_model_by_alias=True,
    status_code=status.HTTP_201_CREATED,
)
def create_album(payload: AlbumIn, db: DbSession, current: CurrentUser = Depends(managers)):
    return _album_out(db, media_service.create_album(db, payload, current))


@router.get("/albums/{album_id}", response_model=AlbumOut, response_model_by_alias=True)
def get_album(album_id: uuid.UUID, db: DbSession, current: CurrentUser = Depends(managers)):
    """Álbum con sus archivos, las personas etiquetadas y las advertencias de permiso."""
    return _album_out(db, media_service.get_album(db, album_id))


@router.patch("/albums/{album_id}", response_model=AlbumOut, response_model_by_alias=True)
def update_album(
    album_id: uuid.UUID,
    payload: AlbumUpdate,
    db: DbSession,
    current: CurrentUser = Depends(managers),
):
    return _album_out(db, media_service.update_album(db, album_id, payload, current))


@router.delete("/albums/{album_id}", response_model=MessageResponse)
def delete_album(
    album_id: uuid.UUID,
    db: DbSession,
    signer: MediaSigner | None = Depends(get_optional_media_signer),
    current: CurrentUser = Depends(managers),
):
    """Elimina un álbum que no está publicado (y sus archivos en Cloudinary)."""
    media_service.delete_album(db, album_id, signer, current)
    return MessageResponse(message="Álbum eliminado.")


@router.post(
    "/albums/{album_id}/upload-signature",
    response_model=UploadSignatureOut,
    response_model_by_alias=True,
)
def upload_signature(
    album_id: uuid.UUID,
    db: DbSession,
    signer: MediaSigner = Depends(get_media_signer),
    current: CurrentUser = Depends(managers),
):
    """Firma para subir un archivo directo a Cloudinary (JPG, PNG, WEBP o MP4)."""
    return UploadSignatureOut(**media_service.upload_signature(db, album_id, signer))


@router.post(
    "/albums/{album_id}/assets",
    response_model=AssetOut,
    response_model_by_alias=True,
    status_code=status.HTTP_201_CREATED,
)
def add_asset(
    album_id: uuid.UUID,
    payload: AssetIn,
    db: DbSession,
    signer: MediaSigner = Depends(get_media_signer),
    current: CurrentUser = Depends(managers),
):
    """Registra un archivo ya subido a Cloudinary. Un álbum publicado vuelve a revisión."""
    asset = media_service.add_asset(db, album_id, payload, signer, current)
    return _asset_out(asset, {})


@router.delete("/assets/{asset_id}", response_model=MessageResponse)
def remove_asset(
    asset_id: uuid.UUID,
    db: DbSession,
    signer: MediaSigner | None = Depends(get_optional_media_signer),
    current: CurrentUser = Depends(managers),
):
    """Quita el archivo del álbum y lo borra de Cloudinary al confirmar."""
    media_service.remove_asset(db, asset_id, signer, current)
    return MessageResponse(message="Archivo quitado del álbum.")


@router.put("/assets/{asset_id}/tags", response_model=AssetOut, response_model_by_alias=True)
def set_tags(
    asset_id: uuid.UUID,
    payload: TagsIn,
    db: DbSession,
    current: CurrentUser = Depends(managers),
):
    """Personas que aparecen en la foto. tags[].imageConsent=false bloquea la publicación."""
    asset = media_service.set_tags(db, asset_id, payload.patient_ids, current)
    people = media_repository.patients(db, {tag.patient_id for tag in asset.tags})
    return _asset_out(asset, people)


@router.post("/albums/{album_id}/publish", response_model=AlbumOut, response_model_by_alias=True)
def publish(
    album_id: uuid.UUID,
    payload: AlbumPublish,
    db: DbSession,
    current: CurrentUser = Depends(managers),
):
    """Publica en el sitio: exige la revisión de permisos y ninguna advertencia pendiente."""
    return _album_out(
        db, media_service.publish(db, album_id, payload.permissions_reviewed, current)
    )


@router.post("/albums/{album_id}/unpublish", response_model=AlbumOut, response_model_by_alias=True)
def unpublish(album_id: uuid.UUID, db: DbSession, current: CurrentUser = Depends(managers)):
    return _album_out(db, media_service.unpublish(db, album_id, current))


def _public_summary(album: MediaAlbum) -> PublicAlbumSummaryOut:
    return PublicAlbumSummaryOut(
        id=album.id,
        title=album.title,
        description=album.description,
        asset_count=len(album.assets),
        cover_url=_cover(album),
    )


@public_router.get(
    "/albums", response_model=list[PublicAlbumSummaryOut], response_model_by_alias=True
)
def public_albums(db: DbSession):
    """Álbumes publicados (sin etiquetas ni datos de afiliados)."""
    return [_public_summary(album) for album in media_service.public_albums(db)]


@public_router.get(
    "/albums/{album_id}", response_model=PublicAlbumOut, response_model_by_alias=True
)
def public_album(album_id: uuid.UUID, db: DbSession):
    album = media_service.public_album(db, album_id)
    return PublicAlbumOut(
        **_public_summary(album).model_dump(),
        assets=[
            PublicAssetOut(
                id=a.id,
                kind=a.kind,
                url=a.url,
                thumbnail_url=a.thumbnail_url,
                width=a.width,
                height=a.height,
            )
            for a in album.assets
        ],
    )
