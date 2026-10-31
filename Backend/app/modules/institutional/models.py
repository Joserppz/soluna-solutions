import datetime as dt
import uuid

from sqlalchemy import DateTime, ForeignKey, String, Uuid, func
from sqlalchemy.dialects.postgresql import JSONB
from sqlalchemy.orm import Mapped, mapped_column

from app.core.database import Base


class InstitutionalSection(Base):
    """Sección del sitio con borrador y versión publicada (RF-07 / RF-08)."""

    __tablename__ = "institutional_sections"

    id: Mapped[uuid.UUID] = mapped_column(
        Uuid, primary_key=True, server_default=func.gen_random_uuid()
    )
    key: Mapped[str] = mapped_column(String, unique=True)
    title: Mapped[str] = mapped_column(String)
    draft_content: Mapped[dict] = mapped_column(JSONB, default=dict)
    published_content: Mapped[dict | None] = mapped_column(JSONB)
    draft_updated_by: Mapped[uuid.UUID | None] = mapped_column(
        ForeignKey("users.id", ondelete="SET NULL")
    )
    draft_updated_at: Mapped[dt.datetime | None] = mapped_column(DateTime(timezone=True))
    published_by: Mapped[uuid.UUID | None] = mapped_column(
        ForeignKey("users.id", ondelete="SET NULL")
    )
    published_at: Mapped[dt.datetime | None] = mapped_column(DateTime(timezone=True))
    created_at: Mapped[dt.datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now()
    )
    updated_at: Mapped[dt.datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now()
    )
