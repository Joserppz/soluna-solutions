"""Descarga del inventario: los bienes de la Alcaldía van en su propia hoja (rendición de
cuentas) y el resto en otra. Las filas son las del filtro del listado."""

from app.core.reports import Sheet
from app.modules.inventory.models import (
    CATEGORY_LABELS,
    CONDITION_LABELS,
    ORIGIN_LABELS,
    InventoryItem,
)

HEADERS = (
    "Código",
    "Material",
    "Categoría",
    "Cantidad",
    "Condición",
    "Origen",
    "Donante o institución",
    "Ingreso",
    "Ubicación",
    "Estado",
)
MUNICIPAL_TITLE = "Bienes de la Alcaldía"
OTHERS_TITLE = "Bienes propios y donados"


def _row(item: InventoryItem) -> list:
    return [
        item.code or "",
        item.name,
        CATEGORY_LABELS[item.category],
        item.quantity,
        CONDITION_LABELS[item.condition],
        ORIGIN_LABELS[item.origin],
        item.donor_or_institution,
        item.entry_date,
        item.location,
        "Dado de baja" if item.deleted_at else "Activo",
    ]


def sheets(municipal: list[InventoryItem], others: list[InventoryItem]) -> list[Sheet]:
    return [
        Sheet("Alcaldía", HEADERS, [_row(item) for item in municipal], MUNICIPAL_TITLE),
        Sheet("Propios y donados", HEADERS, [_row(item) for item in others], OTHERS_TITLE),
    ]
