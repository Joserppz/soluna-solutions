"""DTOs del inventario (camelCase)."""

import datetime as dt
import uuid
from typing import Literal

from pydantic import Field

from app.core.pagination import Page
from app.core.schemas import CamelModel
from app.modules.inventory.models import (
    CATEGORY_LABELS,
    CONDITION_LABELS,
    MOVEMENT_LABELS,
    ORIGIN_LABELS,
    InventoryItem,
)

ItemCategory = Literal[tuple(CATEGORY_LABELS)]
ItemCondition = Literal[tuple(CONDITION_LABELS)]
ItemOrigin = Literal[tuple(ORIGIN_LABELS)]
MovementType = Literal[tuple(MOVEMENT_LABELS)]
# La baja se registra con POST /inventory/{id}/deactivate, no como movimiento suelto
ManualMovementType = Literal["ingreso", "prestamo", "devolucion", "ajuste"]


class ItemIn(CamelModel):
    code: str | None = Field(default=None, max_length=30)
    name: str = Field(max_length=120)
    category: ItemCategory
    quantity: int = Field(ge=0, le=100000)
    condition: ItemCondition
    origin: ItemOrigin
    donor_or_institution: str = Field(default="", max_length=120)
    entry_date: dt.date | None = None
    location: str = Field(default="", max_length=120)


class ItemUpdate(CamelModel):
    code: str | None = Field(default=None, max_length=30)
    name: str | None = Field(default=None, max_length=120)
    category: ItemCategory | None = None
    # Un cambio de cantidad queda como movimiento «ajuste» y exige reason
    quantity: int | None = Field(default=None, ge=0, le=100000)
    condition: ItemCondition | None = None
    origin: ItemOrigin | None = None
    donor_or_institution: str | None = Field(default=None, max_length=120)
    entry_date: dt.date | None = None
    location: str | None = Field(default=None, max_length=120)
    # «Motivo del cambio» del diseño
    reason: str | None = Field(default=None, max_length=300)


class MovementIn(CamelModel):
    movement_type: ManualMovementType
    # Unidades: positivas siempre, salvo en «ajuste», donde el signo indica si suma o resta
    quantity: int = Field(ge=-100000, le=100000)
    reason: str = Field(default="", max_length=300)
    counterpart: str = Field(default="", max_length=120)


class ItemDeactivate(CamelModel):
    reason: str = Field(min_length=3, max_length=300)


class ItemOut(CamelModel):
    id: uuid.UUID
    code: str | None
    name: str
    category: ItemCategory
    category_label: str
    quantity: int
    condition: ItemCondition
    condition_label: str
    origin: ItemOrigin
    origin_label: str
    donor_or_institution: str
    entry_date: dt.date
    location: str
    active: bool
    deactivation_reason: str | None
    created_at: dt.datetime
    updated_at: dt.datetime


class ItemPage(Page[ItemOut]):
    """Página del inventario."""


class MovementOut(CamelModel):
    id: uuid.UUID
    movement_type: MovementType
    movement_label: str
    quantity_delta: int
    reason: str
    counterpart: str
    user_name: str | None
    created_at: dt.datetime


class InventorySummary(CamelModel):
    """Contadores del encabezado (diseño pág. 11): materiales activos, no unidades."""

    total: int
    alcaldia: int
    donado: int
    propio: int
    damaged: int


def to_item_out(item: InventoryItem) -> ItemOut:
    return ItemOut(
        id=item.id,
        code=item.code,
        name=item.name,
        category=item.category,
        category_label=CATEGORY_LABELS[item.category],
        quantity=item.quantity,
        condition=item.condition,
        condition_label=CONDITION_LABELS[item.condition],
        origin=item.origin,
        origin_label=ORIGIN_LABELS[item.origin],
        donor_or_institution=item.donor_or_institution,
        entry_date=item.entry_date,
        location=item.location,
        active=item.active,
        deactivation_reason=item.deactivation_reason,
        created_at=item.created_at,
        updated_at=item.updated_at,
    )
