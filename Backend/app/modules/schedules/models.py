import datetime as dt
import uuid

from sqlalchemy import Date, DateTime, ForeignKey, Integer, String, Time, Uuid, func
from sqlalchemy.orm import Mapped, mapped_column

from app.core.database import Base

CATEGORY_LABELS = {
    "fisioterapia": "Fisioterapia",
    "arteterapia": "Arteterapia",
    "fonoaudiologia": "Fonoaudiología",
    "psicologia": "Psicología",
    "teatro": "Teatro",
    "familias": "Familias",
    "comunitario": "Encuentro comunitario",
}
CATEGORIES = tuple(CATEGORY_LABELS)
# borrador: no se ve en el sitio · publicada · cancelada: se sigue viendo, tachada, con aviso
STATUSES = ("borrador", "publicada", "cancelada")
PUBLIC_STATUSES = ("publicada", "cancelada")


class Schedule(Base):
    """Actividad de la agenda (RF-04, diseño págs. 2, 3 y 12)."""

    __tablename__ = "schedules"

    id: Mapped[uuid.UUID] = mapped_column(
        Uuid, primary_key=True, server_default=func.gen_random_uuid()
    )
    title: Mapped[str] = mapped_column(String)
    category: Mapped[str] = mapped_column(String)
    date: Mapped[dt.date] = mapped_column(Date)
    start_time: Mapped[dt.time] = mapped_column(Time)
    end_time: Mapped[dt.time] = mapped_column(Time)
    location: Mapped[str] = mapped_column(String)
    professional_id: Mapped[uuid.UUID | None] = mapped_column(
        ForeignKey("users.id", ondelete="SET NULL")
    )
    professional_name: Mapped[str] = mapped_column(String, default="")
    description: Mapped[str] = mapped_column(String, default="")
    # Cupos informativos: no hay sistema de reservas
    spots: Mapped[int | None] = mapped_column(Integer)
    status: Mapped[str] = mapped_column(String, default="borrador")
    cancellation_note: Mapped[str | None] = mapped_column(String)
    image_url: Mapped[str | None] = mapped_column(String)
    attendance_closed_at: Mapped[dt.datetime | None] = mapped_column(DateTime(timezone=True))
    attendance_closed_by: Mapped[uuid.UUID | None] = mapped_column(
        ForeignKey("users.id", ondelete="SET NULL")
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
