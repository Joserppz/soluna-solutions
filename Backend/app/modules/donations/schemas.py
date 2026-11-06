"""DTOs de donaciones y de la meta pública (camelCase). Montos en bolivianos."""

import datetime as dt
import uuid
from decimal import Decimal
from typing import Literal

from pydantic import Field

from app.core.pagination import Page
from app.core.schemas import CamelModel
from app.modules.donations.models import (
    CHANNEL_LABELS,
    DEFAULT_PURPOSE,
    MILESTONE_STATUSES,
    STATUS_LABELS,
    Donation,
)
from app.modules.inventory.schemas import ItemCategory, ItemCondition

DonationChannel = Literal[tuple(CHANNEL_LABELS)]
DonationStatus = Literal[tuple(STATUS_LABELS)]
MilestoneStatus = Literal[MILESTONE_STATUSES]
Amount = Decimal


# ---------------------------------------------------------------------------
# Sitio público
# ---------------------------------------------------------------------------
class DonationNoticeIn(CamelModel):
    """«Avísanos de tu aporte» (diseño pág. 4): el aporte ya se hizo por QR bancario."""

    donor_name: str | None = Field(default=None, max_length=120)
    donor_contact: str | None = Field(default=None, max_length=120)
    amount_bs: Amount = Field(gt=0, le=100000, max_digits=8, decimal_places=2)
    # Nro. de comprobante (opcional): ayuda a confirmarlo más rápido
    declared_reference: str | None = Field(default=None, max_length=60)
    purpose: str = Field(default=DEFAULT_PURPOSE, max_length=120)
    turnstile_token: str = Field(max_length=2048)


class DonationTrackingOut(CamelModel):
    """En qué paso está el aporte (diseño pág. 5), sin datos de quien donó."""

    id: uuid.UUID
    status: DonationStatus
    status_label: str
    amount_bs: float
    created_at: dt.datetime


class MilestoneOut(CamelModel):
    label: str
    status: MilestoneStatus


class PublicGoalOut(CamelModel):
    title: str
    description: str
    target_bs: float
    # Solo los aportes confirmados (más el ajuste manual de la meta)
    raised_bs: float
    percent: int
    confirmed_count: int
    milestones: list[MilestoneOut]


# ---------------------------------------------------------------------------
# Espacio del equipo
# ---------------------------------------------------------------------------
class DonationOut(CamelModel):
    id: uuid.UUID
    donor_name: str | None
    donor_contact: str | None
    channel: DonationChannel
    channel_label: str
    source: Literal["sitio", "sede"]
    amount_bs: float | None
    in_kind_description: str | None
    estimated_value_bs: float | None
    purpose: str
    status: DonationStatus
    status_label: str
    declared_reference: str | None
    bank_reference: str | None
    credited_on: dt.date | None
    cancellation_reason: str | None
    inventory_item_id: uuid.UUID | None
    date: dt.date
    reviewed_at: dt.datetime | None
    created_at: dt.datetime


class DonationPage(Page[DonationOut]):
    """Página del registro de aportes."""


class DonationConfirm(CamelModel):
    # «Referencia en el extracto» y «Fecha de acreditación» (diseño pág. 15)
    bank_reference: str = Field(min_length=3, max_length=60)
    credited_on: dt.date


class DonationCancel(CamelModel):
    reason: str = Field(min_length=3, max_length=300)


class DonationManualIn(CamelModel):
    """«Registrar un aporte recibido» en la sede (diseño pág. 16).

    Efectivo entra confirmado; QR bancario (la persona transfiere en la sede) entra
    pendiente y se confirma con el extracto, como un aviso del sitio; en especie entra
    recibido.
    """

    channel: Literal["efectivo", "qr_bancario", "especie"]
    donor_name: str | None = Field(default=None, max_length=120)
    donor_contact: str | None = Field(default=None, max_length=120)
    date: dt.date | None = None
    purpose: str = Field(default=DEFAULT_PURPOSE, max_length=120)
    # Efectivo o QR bancario: el monto; el recibo de la sede o el comprobante del banco
    amount_bs: Amount | None = Field(default=None, gt=0, le=100000, max_digits=8, decimal_places=2)
    receipt_number: str | None = Field(default=None, max_length=60)
    # En especie
    in_kind_description: str | None = Field(default=None, max_length=300)
    quantity: int = Field(default=1, ge=1, le=10000)
    condition: ItemCondition = "bueno"
    category: ItemCategory = "otro"
    estimated_value_bs: Amount | None = Field(
        default=None, gt=0, le=10000000, max_digits=10, decimal_places=2
    )
    # «Agregar al inventario como material donado»
    add_to_inventory: bool = True


class MilestoneIn(CamelModel):
    label: str = Field(min_length=3, max_length=80)
    status: MilestoneStatus = "pendiente"


class GoalIn(CamelModel):
    title: str = Field(min_length=3, max_length=120)
    description: str = Field(default="", max_length=300)
    target_bs: Amount = Field(gt=0, le=100000000, max_digits=12, decimal_places=2)
    manual_adjustment_bs: Amount = Field(
        default=Decimal(0), ge=-100000000, le=100000000, max_digits=12, decimal_places=2
    )
    visible: bool = True
    milestones: list[MilestoneIn] = Field(default_factory=list, max_length=10)


class GoalOut(PublicGoalOut):
    id: uuid.UUID
    manual_adjustment_bs: float
    confirmed_bs: float
    visible: bool


class ChannelTotal(CamelModel):
    channel: DonationChannel
    label: str
    amount_bs: float


class DonationSummary(CamelModel):
    """«Este mes llegaron…» (diseño pág. 15)."""

    month: str
    confirmed_bs: float
    confirmed_count: int
    pending_count: int
    in_kind_count: int
    cancelled_count: int
    by_channel: list[ChannelTotal]


def to_donation_out(donation: Donation) -> DonationOut:
    return DonationOut(
        id=donation.id,
        donor_name=donation.donor_name,
        donor_contact=donation.donor_contact,
        channel=donation.channel,
        channel_label=CHANNEL_LABELS[donation.channel],
        source=donation.source,
        amount_bs=float(donation.amount_bs) if donation.amount_bs is not None else None,
        in_kind_description=donation.in_kind_description,
        estimated_value_bs=(
            float(donation.estimated_value_bs) if donation.estimated_value_bs is not None else None
        ),
        purpose=donation.purpose,
        status=donation.status,
        status_label=STATUS_LABELS[donation.status],
        declared_reference=donation.declared_reference,
        bank_reference=donation.bank_reference,
        credited_on=donation.credited_on,
        cancellation_reason=donation.cancellation_reason,
        inventory_item_id=donation.inventory_item_id,
        date=donation.date,
        reviewed_at=donation.reviewed_at,
        created_at=donation.created_at,
    )
