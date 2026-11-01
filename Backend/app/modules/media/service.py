"""Galería de fotos y videos (RF-05, diseño pág. 13).

Solo se publica lo que tiene permiso: un álbum pasa a público cuando alguien marca
«Revisé que todas las personas que se reconocen dieron su permiso» y ninguna persona
etiquetada carece del permiso de imagen en su ficha. Cualquier cambio en un álbum
publicado (una foto o etiqueta nueva) lo devuelve a revisión.
"""

import logging
import uuid

from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from app.adapters.cloudinary import MediaSigner
from app.core import clock
from app.core.database import after_commit
from app.core.errors import Conflict, NotFound, ValidationError
from app.modules.audit import service as audit_service
from app.modules.auth.dependencies import CurrentUser
from app.modules.media import repository as media_repository
from app.modules.media.models import (
    MAX_IMAGE_BYTES,
    MAX_VIDEO_BYTES,
    MediaAlbum,
    MediaAsset,
    MediaPatientTag,
)
from app.modules.media.schemas import AlbumIn, AlbumUpdate, AssetIn
from app.modules.patients.models import Patient
from app.modules.schedules.service import get_schedule

ALBUM_NOT_FOUND = "Álbum no encontrado."
logger = logging.getLogger("aspar.media")
ASSET_NOT_FOUND = "Foto o video no encontrado."
ASSET_DUPLICATED = "Ese archivo ya está registrado en la galería."


def folder(album: MediaAlbum) -> str:
    return f"aspar/albums/{album.id}"


def _audit(
    db: Session,
    current: CurrentUser,
    album: MediaAlbum,
    action: str,
    severity: str = "INFO",
    extra: str = "",
) -> None:
    audit_service.audit(
        db,
        current,
        category="GALERIA",
        severity=severity,
        action=action,
        detail=f"Álbum «{album.title}» ({album.id}){extra}",
    )


def get_album(db: Session, album_id: uuid.UUID) -> MediaAlbum:
    album = media_repository.get_album(db, album_id)
    if album is None:
        raise NotFound(ALBUM_NOT_FOUND)
    return album


def _asset(db: Session, asset_id: uuid.UUID) -> MediaAsset:
    asset = media_repository.get_asset(db, asset_id)
    if asset is None:
        raise NotFound(ASSET_NOT_FOUND)
    return asset


def tagged_patients(db: Session, album: MediaAlbum) -> dict[uuid.UUID, Patient]:
    ids = {tag.patient_id for asset in album.assets for tag in asset.tags}
    return media_repository.patients(db, ids)


def warnings(
    album: MediaAlbum, people: dict[uuid.UUID, Patient]
) -> list[tuple[MediaAsset, Patient]]:
    """Fotos donde aparece alguien sin «Uso de imagen: autorizado» en su ficha."""
    return [
        (asset, people[tag.patient_id])
        for asset in album.assets
        for tag in asset.tags
        if not people[tag.patient_id].image_consent
    ]


def _back_to_review(db: Session, current: CurrentUser, album: MediaAlbum, why: str) -> None:
    if album.visibility == "publico" or album.permissions_reviewed:
        album.visibility = "privado"
        album.permissions_reviewed = False
        album.reviewed_by = None
        album.reviewed_at = None
        _audit(db, current, album, "Álbum devuelto a revisión", "WARNING", f": {why}")


def _validate(album: MediaAlbum) -> None:
    if len(album.title.strip()) < 3:
        raise ValidationError("El título del álbum debe tener al menos 3 caracteres.")


def create_album(db: Session, data: AlbumIn, current: CurrentUser) -> MediaAlbum:
    if data.schedule_id:
        get_schedule(db, data.schedule_id)
    album = MediaAlbum(
        title=data.title.strip(),
        description=data.description.strip(),
        schedule_id=data.schedule_id,
        created_by=current.user.id,
    )
    _validate(album)
    db.add(album)
    db.flush()
    db.refresh(album)
    _audit(db, current, album, "Creación de álbum")
    return album


def update_album(
    db: Session, album_id: uuid.UUID, data: AlbumUpdate, current: CurrentUser
) -> MediaAlbum:
    album = get_album(db, album_id)
    changes = data.model_dump(exclude_unset=True)
    if changes.get("schedule_id"):
        get_schedule(db, changes["schedule_id"])
    if "title" in changes and changes["title"] is None:
        raise ValidationError("El álbum necesita un título.")
    for field, value in changes.items():
        setattr(album, field, value.strip() if isinstance(value, str) else value)
    if album.description is None:
        album.description = ""
    _validate(album)
    _audit(db, current, album, "Actualización de álbum")
    db.flush()
    return album


def _destroy_remote(db: Session, assets: list[MediaAsset], signer: MediaSigner | None) -> None:
    """Borra los archivos en Cloudinary solo si la transacción se confirma.

    Si la base revierte el cambio, los archivos siguen existiendo; si Cloudinary falla,
    after_commit lo deja en el log (el archivo queda huérfano, pero la galería no se rompe).
    Solo se borran archivos de la cuenta de ASPAR (los de demostración no se tocan).
    """
    remote = [(a.public_id, a.kind) for a in assets if signer is not None and signer.owns(a.url)]
    if signer is None and assets:
        logger.warning(
            "Cloudinary no está configurado: %d archivo(s) quedan en la nube", len(assets)
        )
    for public_id, kind in remote:
        after_commit(db, lambda public_id=public_id, kind=kind: signer.destroy(public_id, kind))


def delete_album(
    db: Session, album_id: uuid.UUID, signer: MediaSigner | None, current: CurrentUser
) -> None:
    album = get_album(db, album_id)
    if album.visibility == "publico":
        raise Conflict("Un álbum publicado no se elimina: quítalo del sitio primero.")
    _audit(db, current, album, "Eliminación de álbum", "WARNING")
    _destroy_remote(db, list(album.assets), signer)
    db.delete(album)
    db.flush()


def upload_signature(db: Session, album_id: uuid.UUID, signer: MediaSigner) -> dict:
    return signer.upload_params(folder(get_album(db, album_id)))


def add_asset(
    db: Session, album_id: uuid.UUID, data: AssetIn, signer: MediaSigner, current: CurrentUser
) -> MediaAsset:
    album = get_album(db, album_id)
    if not data.public_id.startswith(folder(album) + "/"):
        raise ValidationError("El archivo no se subió a la carpeta de este álbum.")
    for url in (data.url, data.thumbnail_url):
        if url is not None and not signer.owns(url):
            raise ValidationError("El archivo debe estar en la cuenta de Cloudinary de ASPAR.")
    limit = MAX_IMAGE_BYTES if data.kind == "imagen" else MAX_VIDEO_BYTES
    if data.size_bytes > limit:
        raise ValidationError(f"El archivo supera el máximo de {limit // (1024 * 1024)} MB.")
    if media_repository.asset_by_public_id(db, data.public_id) is not None:
        raise Conflict(ASSET_DUPLICATED)
    asset = MediaAsset(
        album_id=album.id,
        kind=data.kind,
        public_id=data.public_id,
        url=data.url,
        thumbnail_url=data.thumbnail_url,
        width=data.width,
        height=data.height,
        size_bytes=data.size_bytes,
        uploaded_by=current.user.id,
        uploaded_at=clock.now(),
    )
    album.assets.append(asset)
    try:
        # Dos registros simultáneos del mismo archivo: la restricción única decide (409)
        db.flush()
    except IntegrityError as exc:
        raise Conflict(ASSET_DUPLICATED) from exc
    _back_to_review(db, current, album, "se agregó un archivo")
    db.flush()
    return asset


def remove_asset(
    db: Session, asset_id: uuid.UUID, signer: MediaSigner | None, current: CurrentUser
) -> None:
    """Quita el archivo de la galería y, al confirmar, también de Cloudinary."""
    asset = _asset(db, asset_id)
    album = get_album(db, asset.album_id)
    _destroy_remote(db, [asset], signer)
    album.assets.remove(asset)
    _audit(db, current, album, "Archivo quitado del álbum", extra=f": {asset.public_id}")
    db.flush()
    if not album.assets and album.visibility == "publico":
        _back_to_review(db, current, album, "se quedó sin archivos")
        db.flush()


def set_tags(
    db: Session, asset_id: uuid.UUID, patient_ids: list[uuid.UUID], current: CurrentUser
) -> MediaAsset:
    asset = _asset(db, asset_id)
    wanted = set(patient_ids)
    found = media_repository.patients(db, wanted)
    if len(found) != len(wanted):
        raise NotFound("Alguna de las personas etiquetadas no tiene ficha.")
    current_ids = {tag.patient_id for tag in asset.tags}
    if wanted == current_ids:
        return asset
    asset.tags = [
        next(t for t in asset.tags if t.patient_id == pid)
        if pid in current_ids
        else MediaPatientTag(patient_id=pid, tagged_by=current.user.id)
        for pid in sorted(wanted)
    ]
    album = get_album(db, asset.album_id)
    _back_to_review(db, current, album, "cambiaron las personas etiquetadas")
    _audit(
        db,
        current,
        album,
        "Etiquetado de afiliados en la galería",
        extra=f": {len(wanted)} persona(s) en {asset.public_id}",
    )
    db.flush()
    return asset


def publish(db: Session, album_id: uuid.UUID, reviewed: bool, current: CurrentUser) -> MediaAlbum:
    album = get_album(db, album_id)
    if not reviewed:
        raise ValidationError(
            "Marca «Revisé que todas las personas que se reconocen dieron su permiso»."
        )
    if not album.assets:
        raise Conflict("El álbum no tiene fotos ni videos.")
    pending = warnings(album, tagged_patients(db, album))
    if pending:
        photos = len({asset.id for asset, _ in pending})
        raise Conflict(
            f"En {photos} foto(s) aparece una persona sin permiso de imagen en su ficha. "
            "Quítala o tápale el rostro antes de publicar."
        )
    album.permissions_reviewed = True
    album.reviewed_by = current.user.id
    album.reviewed_at = clock.now()
    album.visibility = "publico"
    _audit(
        db,
        current,
        album,
        "Publicación de álbum",
        "WARNING",
        f": {len(album.assets)} archivo(s), permisos revisados",
    )
    db.flush()
    return album


def unpublish(db: Session, album_id: uuid.UUID, current: CurrentUser) -> MediaAlbum:
    album = get_album(db, album_id)
    if album.visibility != "publico":
        raise Conflict("El álbum no está publicado.")
    _back_to_review(db, current, album, "se quitó del sitio")
    db.flush()
    return album


def public_albums(db: Session) -> list[MediaAlbum]:
    return media_repository.list_albums(db, "publico")


def public_album(db: Session, album_id: uuid.UUID) -> MediaAlbum:
    album = media_repository.get_album(db, album_id)
    if album is None or album.visibility != "publico":
        raise NotFound(ALBUM_NOT_FOUND)
    return album
