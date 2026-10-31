"""Exportación del inventario: los bienes de la Alcaldía van aparte (rendición de cuentas)."""

from app.core.spreadsheet import csv_bytes, safe, xlsx_bytes
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
)
MUNICIPAL_TITLE = "Bienes de la Alcaldía"
OTHERS_TITLE = "Bienes propios y donados"


def _row(item: InventoryItem) -> tuple:
    return (
        safe(item.code or ""),
        safe(item.name),
        CATEGORY_LABELS[item.category],
        item.quantity,
        CONDITION_LABELS[item.condition],
        ORIGIN_LABELS[item.origin],
        safe(item.donor_or_institution),
        item.entry_date.strftime("%d/%m/%Y"),
        safe(item.location),
    )


def to_csv(municipal: list[InventoryItem], others: list[InventoryItem]) -> bytes:
    rows: list[tuple] = []
    for title, items in ((MUNICIPAL_TITLE, municipal), (OTHERS_TITLE, others)):
        rows += [(title,), HEADERS, *(_row(item) for item in items), ()]
    return csv_bytes(rows)


def to_xlsx(municipal: list[InventoryItem], others: list[InventoryItem]) -> bytes:
    return xlsx_bytes(
        [
            ("Alcaldía", HEADERS, [_row(item) for item in municipal]),
            ("Propios y donados", HEADERS, [_row(item) for item in others]),
        ]
    )
