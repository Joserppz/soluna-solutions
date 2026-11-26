import uuid

from fastapi import APIRouter, Depends, Query, Response, status

from app.core.database import DbSession
from app.core.pagination import Pagination
from app.core.reports import (
    EXPORT_PERMISSION,
    EXPORT_RESPONSES,
    FORMAT_QUERY,
    FileFormat,
    Range,
    Report,
    describe,
    download,
    log_query,
)
from app.modules.auth.dependencies import CurrentUser, require_permission
from app.modules.inventory import export
from app.modules.inventory import service as inventory_service
from app.modules.inventory.models import (
    CATEGORY_LABELS,
    CONDITION_LABELS,
    MOVEMENT_LABELS,
    ORIGIN_LABELS,
)
from app.modules.inventory.schemas import (
    InventorySummary,
    ItemCategory,
    ItemCondition,
    ItemDeactivate,
    ItemIn,
    ItemOrigin,
    ItemOut,
    ItemPage,
    ItemUpdate,
    MovementIn,
    MovementOut,
    to_item_out,
)
from app.modules.users.models import INVENTORY_MANAGE

router = APIRouter(prefix="/api/v1/inventory", tags=["Inventario"])

managers = require_permission(INVENTORY_MANAGE)
exporters = require_permission(INVENTORY_MANAGE, EXPORT_PERMISSION)


def _movement_out(movement, user_name: str | None) -> MovementOut:
    return MovementOut(
        id=movement.id,
        movement_type=movement.movement_type,
        movement_label=MOVEMENT_LABELS[movement.movement_type],
        quantity_delta=movement.quantity_delta,
        reason=movement.reason,
        counterpart=movement.counterpart,
        user_name=user_name,
        created_at=movement.created_at,
    )


class ItemFilters:
    """Filtros del inventario: los mismos para el listado y la descarga. El rango de
    fechas es por fecha de ingreso del material."""

    def __init__(
        self,
        period: Range,
        search: str | None = Query(default=None, max_length=120),
        origin: ItemOrigin | None = None,
        category: ItemCategory | None = None,
        condition: ItemCondition | None = None,
        include_inactive: bool = Query(default=False, alias="includeInactive"),
    ):
        self.values = {
            "search": search,
            "origin": origin,
            "category": category,
            "condition": condition,
            "include_inactive": include_inactive,
            "period": period,
        }
        self.period = period

    def described(self) -> dict[str, str]:
        v = self.values
        return describe(
            self.period,
            {
                "Búsqueda": v["search"],
                "Origen": ORIGIN_LABELS.get(v["origin"] or ""),
                "Categoría": CATEGORY_LABELS.get(v["category"] or ""),
                "Condición": CONDITION_LABELS.get(v["condition"] or ""),
                "Incluye dados de baja": "Sí" if v["include_inactive"] else None,
            },
        )


@router.get("", response_model=ItemPage, response_model_by_alias=True)
def list_items(
    db: DbSession,
    page: Pagination,
    filters: ItemFilters = Depends(),
    current: CurrentUser = Depends(managers),
):
    """Materiales por nombre, con filtros de origen, categoría, condición y fechas de ingreso."""
    result = inventory_service.list_items(db, page, **filters.values)
    log_query("Inventario", filters.described(), result.total)
    return ItemPage.of(result, to_item_out)


@router.get("/summary", response_model=InventorySummary, response_model_by_alias=True)
def summary(db: DbSession, current: CurrentUser = Depends(managers)):
    """Contadores del encabezado: registrados, de la Alcaldía, donados, propios y dañados."""
    return InventorySummary(**inventory_service.summary(db))


@router.get("/export", response_class=Response, responses=EXPORT_RESPONSES)
def export_inventory(
    db: DbSession,
    filters: ItemFilters = Depends(),
    file_format: FileFormat = FORMAT_QUERY,
    current: CurrentUser = Depends(exporters),
):
    """Todos los materiales del filtro: la Alcaldía en una hoja y el resto en otra."""
    municipal, others = inventory_service.export_items(db, **filters.values)
    report = Report("Inventario", "inventario", "INVENTARIO", filters.described())
    return download(
        db,
        current,
        report,
        export.sheets(municipal, others),
        file_format,
        counted=len(municipal) + len(others),
    )


@router.get("/{item_id}", response_model=ItemOut, response_model_by_alias=True)
def get_item(item_id: uuid.UUID, db: DbSession, current: CurrentUser = Depends(managers)):
    return to_item_out(inventory_service.get_item(db, item_id))


@router.post(
    "", response_model=ItemOut, response_model_by_alias=True, status_code=status.HTTP_201_CREATED
)
def create_item(payload: ItemIn, db: DbSession, current: CurrentUser = Depends(managers)):
    """Registra un material; su cantidad inicial queda como movimiento de ingreso."""
    return to_item_out(inventory_service.create_item(db, payload, current))


@router.patch("/{item_id}", response_model=ItemOut, response_model_by_alias=True)
def update_item(
    item_id: uuid.UUID,
    payload: ItemUpdate,
    db: DbSession,
    current: CurrentUser = Depends(managers),
):
    """Edita el material. Cambiar la cantidad exige «reason» y queda como ajuste."""
    return to_item_out(inventory_service.update_item(db, item_id, payload, current))


@router.get("/{item_id}/movements", response_model=list[MovementOut], response_model_by_alias=True)
def list_movements(item_id: uuid.UUID, db: DbSession, current: CurrentUser = Depends(managers)):
    """«Historial de este material», el más reciente primero."""
    return [_movement_out(m, name) for m, name in inventory_service.movements(db, item_id)]


@router.post(
    "/{item_id}/movements",
    response_model=MovementOut,
    response_model_by_alias=True,
    status_code=status.HTTP_201_CREATED,
)
def add_movement(
    item_id: uuid.UUID,
    payload: MovementIn,
    db: DbSession,
    current: CurrentUser = Depends(managers),
):
    """Ingreso, préstamo, devolución o ajuste; actualiza la cantidad disponible."""
    movement = inventory_service.add_movement(db, item_id, payload, current)
    return _movement_out(movement, current.user.name)


@router.post("/{item_id}/deactivate", response_model=ItemOut, response_model_by_alias=True)
def deactivate(
    item_id: uuid.UUID,
    payload: ItemDeactivate,
    db: DbSession,
    current: CurrentUser = Depends(managers),
):
    """Baja lógica con motivo: deja la cantidad en 0 con un movimiento de baja."""
    return to_item_out(inventory_service.deactivate(db, item_id, payload.reason, current))
