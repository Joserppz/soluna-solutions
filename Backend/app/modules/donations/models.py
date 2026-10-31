import datetime as dt
import uuid
from decimal import Decimal

from sqlalchemy import Boolean, Date, DateTime, ForeignKey, Integer, Numeric, String, Uuid, func
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.core.database import Base

CHANNEL_LABELS = {
    "qr_bancario": "QR bancario",
    "efectivo": "Efectivo en la sede",
    "especie": "En especie",
}
STATUS_LABELS = {
    "pendiente": "Pendiente",
    "confirmado": "Confirmado",
    "recibido": "Recibido",
    "anulado": "Anulado",
}
MILESTONE_STATUSES = ("pendiente", "en_camino", "cubierto")
DEFAULT_PURPOSE = "Donde más se necesite"


class DonationGoalMilestone(Base):
    __tablename__ = "donation_goal_milestones"

    id: Mapped[uuid.UUID] = mapped_column(
        Uuid, primary_key=True, server_default=func.gen_random_uuid()
    )
    goal_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("donation_goals.id", ondelete="CASCADE"))
    label: Mapped[str] = mapped_column(String)
    status: Mapped[str] = mapped_column(String, default="pendiente")
    position: Mapped[int] = mapped_column(Integer, default=0)


class DonationGoal(Base):
    """Meta pública (RF-15): acumulado = aportes confirmados + ajuste manual."""

    __tablename__ = "donation_goals"

    id: Mapped[uuid.UUID] = mapped_column(
        Uuid, primary_key=True, server_default=func.gen_random_uuid()
    )
    title: Mapped[str] = mapped_column(String)
    description: Mapped[str] = mapped_column(String, default="")
    target_bs: Mapped[Decimal] = mapped_column(Numeric(12, 2))
    manual_adjustment_bs: Mapped[Decimal] = mapped_column(Numeric(12, 2), default=Decimal(0))
    visible: Mapped[bool] = mapped_column(Boolean, default=False)
    starts_on: Mapped[dt.date] = mapped_column(Date)
    created_at: Mapped[dt.datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now()
    )
    updated_at: Mapped[dt.datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now()
    )

    milestones: Mapped[list[DonationGoalMilestone]] = relationship(
        lazy="selectin",
        order_by=(DonationGoalMilestone.position, DonationGoalMilestone.id),
        cascade="all, delete-orphan",
    )


class Donation(Base):
    """Aporte por QR bancario, en efectivo o en especie (RF-06 / RF-14). Nunca se borra."""

    __tablename__ = "donations"

    id: Mapped[uuid.UUID] = mapped_column(
        Uuid, primary_key=True, server_default=func.gen_random_uuid()
    )
    donor_name: Mapped[str | None] = mapped_column(String)
    donor_contact: Mapped[str | None] = mapped_column(String)
    channel: Mapped[str] = mapped_column(String)
    source: Mapped[str] = mapped_column(String, default="sitio")
    amount_bs: Mapped[Decimal | None] = mapped_column(Numeric(12, 2))
    in_kind_description: Mapped[str | None] = mapped_column(String)
    estimated_value_bs: Mapped[Decimal | None] = mapped_column(Numeric(12, 2))
    purpose: Mapped[str] = mapped_column(String, default=DEFAULT_PURPOSE)
    status: Mapped[str] = mapped_column(String)
    declared_reference: Mapped[str | None] = mapped_column(String)
    bank_reference: Mapped[str | None] = mapped_column(String)
    credited_on: Mapped[dt.date | None] = mapped_column(Date)
    cancellation_reason: Mapped[str | None] = mapped_column(String)
    goal_id: Mapped[uuid.UUID | None] = mapped_column(
        ForeignKey("donation_goals.id", ondelete="SET NULL")
    )
    inventory_item_id: Mapped[uuid.UUID | None] = mapped_column(
        ForeignKey("inventory_items.id", ondelete="SET NULL")
    )
    registered_by: Mapped[uuid.UUID | None] = mapped_column(
        ForeignKey("users.id", ondelete="SET NULL")
    )
    reviewed_by: Mapped[uuid.UUID | None] = mapped_column(
        ForeignKey("users.id", ondelete="SET NULL")
    )
    reviewed_at: Mapped[dt.datetime | None] = mapped_column(DateTime(timezone=True))
    date: Mapped[dt.date] = mapped_column(Date)
    created_at: Mapped[dt.datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now()
    )
    updated_at: Mapped[dt.datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now()
    )
