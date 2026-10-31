import datetime as dt
import uuid

from sqlalchemy import Boolean, DateTime, ForeignKey, Integer, String, Uuid, func
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.core.database import Base

# Tamaño máximo por archivo (Cloudinary lo informa al terminar la subida)
MAX_IMAGE_BYTES = 10 * 1024 * 1024
MAX_VIDEO_BYTES = 100 * 1024 * 1024


class MediaPatientTag(Base):
    """Afiliado que aparece en una foto o video (etiqueta opcional)."""

    __tablename__ = "media_patient_tags"

    asset_id: Mapped[uuid.UUID] = mapped_column(
        ForeignKey("media_assets.id", ondelete="CASCADE"), primary_key=True
    )
    patient_id: Mapped[uuid.UUID] = mapped_column(
        ForeignKey("patients.id", ondelete="RESTRICT"), primary_key=True
    )
    tagged_by: Mapped[uuid.UUID | None] = mapped_column(ForeignKey("users.id", ondelete="SET NULL"))
    created_at: Mapped[dt.datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now()
    )


class MediaAsset(Base):
    __tablename__ = "media_assets"

    id: Mapped[uuid.UUID] = mapped_column(
        Uuid, primary_key=True, server_default=func.gen_random_uuid()
    )
    album_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("media_albums.id", ondelete="CASCADE"))
    kind: Mapped[str] = mapped_column(String)
    provider: Mapped[str] = mapped_column(String, default="cloudinary")
    public_id: Mapped[str] = mapped_column(String, unique=True)
    url: Mapped[str] = mapped_column(String)
    thumbnail_url: Mapped[str | None] = mapped_column(String)
    width: Mapped[int | None] = mapped_column(Integer)
    height: Mapped[int | None] = mapped_column(Integer)
    size_bytes: Mapped[int] = mapped_column(Integer)
    uploaded_by: Mapped[uuid.UUID | None] = mapped_column(
        ForeignKey("users.id", ondelete="SET NULL")
    )
    uploaded_at: Mapped[dt.datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now()
    )

    tags: Mapped[list[MediaPatientTag]] = relationship(
        lazy="selectin", cascade="all, delete-orphan"
    )


class MediaAlbum(Base):
    """Álbum de la galería (RF-05). Se publica solo con la revisión de permisos marcada."""

    __tablename__ = "media_albums"

    id: Mapped[uuid.UUID] = mapped_column(
        Uuid, primary_key=True, server_default=func.gen_random_uuid()
    )
    title: Mapped[str] = mapped_column(String)
    description: Mapped[str] = mapped_column(String, default="")
    visibility: Mapped[str] = mapped_column(String, default="privado")
    permissions_reviewed: Mapped[bool] = mapped_column(Boolean, default=False)
    reviewed_by: Mapped[uuid.UUID | None] = mapped_column(
        ForeignKey("users.id", ondelete="SET NULL")
    )
    reviewed_at: Mapped[dt.datetime | None] = mapped_column(DateTime(timezone=True))
    schedule_id: Mapped[uuid.UUID | None] = mapped_column(
        ForeignKey("schedules.id", ondelete="SET NULL")
    )
    created_by: Mapped[uuid.UUID | None] = mapped_column(
        ForeignKey("users.id", ondelete="SET NULL")
    )
    created_at: Mapped[dt.datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now()
    )
    updated_at: Mapped[dt.datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now()
    )

    assets: Mapped[list[MediaAsset]] = relationship(
        lazy="selectin",
        order_by=(MediaAsset.uploaded_at, MediaAsset.id),
        cascade="all, delete-orphan",
    )
