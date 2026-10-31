"""Inventario de materiales y equipos (RF-03, SRS v2.0, diseño pág. 11).

Cada cambio de cantidad queda en inventory_movements (ingreso, préstamo, devolución,
baja o ajuste): el historial nunca se edita. Los materiales no se borran: se dan de
baja con un motivo.
"""

import datetime as dt
import uuid

from sqlalchemy.orm import Session

from app.core import clock
from app.core.errors import Conflict, NotFound, ValidationError
from app.core.pagination import PageParams, PageResult
from app.modules.audit import service as audit_service
from app.modules.auth.dependencies import CurrentUser
from app.modules.inventory import repository as inventory_repository
from app.modules.inventory.models import MOVEMENT_LABELS, InventoryItem, InventoryMovement
from app.modules.inventory.schemas import ItemIn, ItemUpdate, MovementIn

NOT_FOUND = "Material no encontrado."
INACTIVE = "El material está dado de baja."
OLDEST_DATE = dt.date(2000, 1, 1)
# Signo fijo de cada tipo; el ajuste usa el signo que se envía
SIGNS = {"ingreso": 1, "devolucion": 1, "prestamo": -1, "baja": -1}


def _audit(db: Session, current: CurrentUser, item: InventoryItem, severity: str, action: str):
    audit_service.audit(
        db,
        current,
        category="INVENTARIO",
        severity=severity,
        action=action,
        detail=f"{item.name} ({item.id}): {item.quantity} u., {item.condition}, {item.origin}",
    )


def get_item(db: Session, item_id: uuid.UUID, lock: bool = False) -> InventoryItem:
    item = inventory_repository.get(db, item_id, lock)
    if item is None:
        raise NotFound(NOT_FOUND)
    return item


def list_items(db: Session, page: PageParams, **filters) -> PageResult:
    return inventory_repository.list_items(db, page, **filters)


def _validate(item: InventoryItem) -> None:
    if len(item.name.strip()) < 2:
        raise ValidationError("Escribe el nombre del material.")
    if item.entry_date > clock.today():
        raise ValidationError("La fecha de ingreso no puede ser futura.")
    if item.entry_date < OLDEST_DATE:
        raise ValidationError("Revisa la fecha de ingreso.")
    if item.code is not None and len(item.code) < 2:
        raise ValidationError("El código debe tener al menos 2 caracteres.")


def _check_code(db: Session, code: str | None, item_id: uuid.UUID | None = None) -> None:
    if code:
        existing = inventory_repository.get_by_code(db, code)
        if existing is not None and existing.id != item_id:
            raise Conflict("Ya existe un material con ese código.")


def _movement(
    db: Session,
    item: InventoryItem,
    movement_type: str,
    delta: int,
    user_id: uuid.UUID | None,
    reason: str = "",
    counterpart: str = "",
) -> InventoryMovement:
    movement = InventoryMovement(
        item_id=item.id,
        movement_type=movement_type,
        quantity_delta=delta,
        reason=reason.strip(),
        counterpart=counterpart.strip(),
        user_id=user_id,
        # Hora real (no la de la transacción): el historial queda en orden aunque dos
        # movimientos se registren en la misma operación
        created_at=clock.now(),
    )
    db.add(movement)
    return movement


def register_item(
    db: Session, data: ItemIn, user_id: uuid.UUID | None, reason: str = "Ingreso inicial"
) -> InventoryItem:
    """Crea el material y su movimiento de ingreso (también lo usan las donaciones en especie)."""
    code = (data.code or "").strip() or None
    _check_code(db, code)
    item = InventoryItem(
        code=code,
        name=data.name.strip(),
        category=data.category,
        quantity=data.quantity,
        condition=data.condition,
        origin=data.origin,
        donor_or_institution=data.donor_or_institution.strip(),
        entry_date=data.entry_date or clock.today(),
        location=data.location.strip(),
        created_by=user_id,
    )
    _validate(item)
    db.add(item)
    db.flush()
    if item.quantity:
        _movement(db, item, "ingreso", item.quantity, user_id, reason)
    db.flush()
    db.refresh(item)
    return item


def create_item(db: Session, data: ItemIn, current: CurrentUser) -> InventoryItem:
    item = register_item(db, data, current.user.id)
    _audit(db, current, item, "INFO", "Registro de material")
    return item


def update_item(
    db: Session, item_id: uuid.UUID, data: ItemUpdate, current: CurrentUser
) -> InventoryItem:
    item = get_item(db, item_id, lock=True)
    if not item.active:
        raise Conflict(INACTIVE)
    changes = data.model_dump(exclude_unset=True)
    reason = (changes.pop("reason", None) or "").strip()
    for field in ("name", "category", "condition", "origin", "entry_date"):
        if field in changes and changes[field] is None:
            raise ValidationError("No se puede dejar vacío un dato obligatorio del material.")

    new_quantity = changes.pop("quantity", None)
    if new_quantity is not None and new_quantity != item.quantity:
        if len(reason) < 3:
            raise ValidationError("Indica el motivo del cambio de cantidad.")
        _movement(db, item, "ajuste", new_quantity - item.quantity, current.user.id, reason)
        item.quantity = new_quantity
    if "code" in changes:
        changes["code"] = (changes["code"] or "").strip() or None
        _check_code(db, changes["code"], item.id)
    for field, value in changes.items():
        setattr(item, field, value.strip() if isinstance(value, str) else value)
    _validate(item)
    _audit(db, current, item, "INFO", "Actualización de material")
    db.flush()
    db.refresh(item)
    return item


def add_movement(
    db: Session, item_id: uuid.UUID, data: MovementIn, current: CurrentUser
) -> InventoryMovement:
    item = get_item(db, item_id, lock=True)
    if not item.active:
        raise Conflict(INACTIVE)
    if data.quantity == 0:
        raise ValidationError("La cantidad del movimiento no puede ser cero.")
    if data.movement_type == "ajuste":
        delta = data.quantity
        if len(data.reason.strip()) < 3:
            raise ValidationError("Indica el motivo del ajuste.")
    else:
        if data.quantity < 0:
            raise ValidationError("Indica la cantidad en positivo.")
        delta = SIGNS[data.movement_type] * data.quantity
    if item.quantity + delta < 0:
        raise Conflict(f"Solo hay {item.quantity} unidades disponibles de {item.name}.")
    if data.movement_type == "prestamo" and not data.counterpart.strip():
        raise ValidationError("Indica a quién se presta el material.")

    movement = _movement(
        db, item, data.movement_type, delta, current.user.id, data.reason, data.counterpart
    )
    item.quantity += delta
    audit_service.audit(
        db,
        current,
        category="INVENTARIO",
        action=f"{MOVEMENT_LABELS[data.movement_type]} de material",
        detail=(
            f"{item.name} ({item.id}): {delta:+d} u. (quedan {item.quantity})"
            + (f", {data.counterpart.strip()}" if data.counterpart.strip() else "")
        ),
    )
    db.flush()
    db.refresh(movement)
    return movement


def deactivate(db: Session, item_id: uuid.UUID, reason: str, current: CurrentUser) -> InventoryItem:
    """Baja lógica con motivo: el material y su historial se conservan."""
    item = get_item(db, item_id, lock=True)
    if not item.active:
        raise Conflict("El material ya está dado de baja.")
    if item.quantity:
        _movement(db, item, "baja", -item.quantity, current.user.id, reason)
        item.quantity = 0
    item.deleted_at = clock.now()
    item.deactivation_reason = reason.strip()
    _audit(db, current, item, "WARNING", "Baja de material")
    db.flush()
    db.refresh(item)
    return item


def movements(db: Session, item_id: uuid.UUID):
    get_item(db, item_id)
    return inventory_repository.movements(db, item_id)


def summary(db: Session) -> dict[str, int]:
    return inventory_repository.summary(db)


def export_items(db: Session) -> tuple[list[InventoryItem], list[InventoryItem]]:
    """Materiales activos separados: los de la Alcaldía (rendición de cuentas) y los demás."""
    items = inventory_repository.all_active(db)
    return (
        [item for item in items if item.origin == "alcaldia"],
        [item for item in items if item.origin != "alcaldia"],
    )
