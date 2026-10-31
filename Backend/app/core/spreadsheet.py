"""Exportaciones a CSV (Excel en español) y a Excel (.xlsx) compartidas por los módulos."""

import csv
import io
from collections.abc import Iterable, Sequence

from openpyxl import Workbook
from openpyxl.styles import Font

# Un texto que empieza con estos caracteres se ejecutaría como fórmula al abrirlo en Excel
FORMULA_PREFIXES = ("=", "+", "-", "@", "\t", "\r")

XLSX_MEDIA_TYPE = "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
CSV_MEDIA_TYPE = "text/csv; charset=utf-8"


def safe(value: str) -> str:
    """Evita la inyección de fórmulas en los textos que escribe una persona."""
    return f"'{value}" if value.startswith(FORMULA_PREFIXES) else value


def csv_bytes(rows: Iterable[Sequence]) -> bytes:
    """CSV con BOM y punto y coma: Excel en español lo abre con tildes y columnas."""
    buffer = io.StringIO()
    writer = csv.writer(buffer, delimiter=";", lineterminator="\r\n")
    writer.writerows(rows)
    return ("﻿" + buffer.getvalue()).encode("utf-8")


def xlsx_bytes(sheets: Sequence[tuple[str, Sequence[str], Iterable[Sequence]]]) -> bytes:
    """Un libro con una hoja por (título, encabezados, filas); encabezados en negrita."""
    workbook = Workbook()
    workbook.remove(workbook.active)
    for title, headers, rows in sheets:
        sheet = workbook.create_sheet(title[:31])
        sheet.append(list(headers))
        for row in rows:
            sheet.append(list(row))
        for cell in sheet[1]:
            cell.font = Font(bold=True)
        for index, header in enumerate(headers):
            sheet.column_dimensions[sheet.cell(row=1, column=index + 1).column_letter].width = max(
                12, len(header) + 4
            )
    buffer = io.BytesIO()
    workbook.save(buffer)
    return buffer.getvalue()
