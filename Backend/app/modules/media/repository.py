import uuid

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.modules.media.models import MediaAlbum, MediaAsset
from app.modules.patients.models import Patient


def list_albums(db: Session, visibility: str | None = None) -> list[MediaAlbum]:
    query = select(MediaAlbum).order_by(MediaAlbum.created_at.desc(), MediaAlbum.id)
    if visibility:
        query = query.where(MediaAlbum.visibility == visibility)
    return list(db.scalars(query))


def get_album(db: Session, album_id: uuid.UUID) -> MediaAlbum | None:
    return db.get(MediaAlbum, album_id)


def get_asset(db: Session, asset_id: uuid.UUID) -> MediaAsset | None:
    return db.get(MediaAsset, asset_id)


def asset_by_public_id(db: Session, public_id: str) -> MediaAsset | None:
    return db.scalar(select(MediaAsset).where(MediaAsset.public_id == public_id))


def patients(db: Session, patient_ids: set[uuid.UUID]) -> dict[uuid.UUID, Patient]:
    if not patient_ids:
        return {}
    return {p.id: p for p in db.scalars(select(Patient).where(Patient.id.in_(patient_ids)))}
