import datetime as dt
import uuid

from sqlalchemy import Date, DateTime, ForeignKey, Integer, String, Uuid, func
from sqlalchemy.orm import Mapped, mapped_column

from app.core.database import Base

# Valores del SRS v2.0 (diseño pág. 11) con su nombre visible
CATEGORY_LABELS = {
    "fisioterapia": "Fisioterapia",
    "movilidad": "Apoyo a la movilidad",
    "mobiliario": "Mobiliario",
    "papeleria": "Papelería",
    "otro": "Otro",
}
CONDITION_LABELS = {"nuevo": "Nuevo", "bueno": "Bueno", "regular": "Regular", "dañado": "Dañado"}
ORIGIN_LABELS = {"propio": "Propio", "donado": "Donado", "alcaldia": "Alcaldía"}
# Signo de cada movimiento: ingreso y devolución suman; préstamo y baja restan;
# el ajuste lleva su propio signo (corrección de un conteo)
MOVEMENT_LABELS = {
    "ingreso": "Ingreso",
    "prestamo": "Préstamo",
    "devolucion": "Devolución",
    "baja": "Baja",
    "ajuste": "Ajuste",
}


class InventoryItem(Base):
    """Material o equipo de la asociación (RF-03, SRS v2.0)."""

    __tablename__ = "inventory_items"

    id: Mapped[uuid.UUID] = mapped_column(
        Uuid, primary_key=True, server_default=func.gen_random_uuid()
    )
    code: Mapped[str | None] = mapped_column(String, unique=True)
    name: Mapped[str] = mapped_column(String)
    category: Mapped[str] = mapped_column(String)
    quantity: Mapped[int] = mapped_column(Integer)
    condition: Mapped[str] = mapped_column(String)
    origin: Mapped[str] = mapped_column(String)
    # Quién lo donó o qué institución lo entregó (p. ej. «Gobierno Municipal»)
    donor_or_institution: Mapped[str] = mapped_column(String, default="")
    entry_date: Mapped[dt.date] = mapped_column(Date)
    location: Mapped[str] = mapped_column(String, default="")
    deleted_at: Mapped[dt.datetime | None] = mapped_column(DateTime(timezone=True))
    deactivation_reason: Mapped[str | None] = mapped_column(String)
    created_by: Mapped[uuid.UUID | None] = mapped_column(
        ForeignKey("users.id", ondelete="SET NULL")
    )
    created_at: Mapped[dt.datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now()
    )
    updated_at: Mapped[dt.datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now()
    )

    @property
    def active(self) -> bool:
        return self.deleted_at is None


class InventoryMovement(Base):
    """Historial de un material: nunca se edita ni se borra."""

    __tablename__ = "inventory_movements"

    id: Mapped[uuid.UUID] = mapped_column(
        Uuid, primary_key=True, server_default=func.gen_random_uuid()
    )
    item_id: Mapped[uuid.UUID] = mapped_column(
        ForeignKey("inventory_items.id", ondelete="RESTRICT")
    )
    movement_type: Mapped[str] = mapped_column(String)
    quantity_delta: Mapped[int] = mapped_column(Integer)
    reason: Mapped[str] = mapped_column(String, default="")
    # A quién se prestó o quién devolvió («Familia Apaza»)
    counterpart: Mapped[str] = mapped_column(String, default="")
    user_id: Mapped[uuid.UUID | None] = mapped_column(ForeignKey("users.id", ondelete="SET NULL"))
    created_at: Mapped[dt.datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now()
    )
