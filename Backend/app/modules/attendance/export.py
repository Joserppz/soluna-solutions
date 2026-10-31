"""Resumen mensual de asistencia en CSV (Excel en español) y en Excel (.xlsx)."""

import csv
import io

from openpyxl import Workbook
from openpyxl.styles import Font

from app.core.spreadsheet import safe
from app.modules.attendance.schemas import MonthlySummaryOut

HEADERS = ("Fecha", "Actividad", "Tipo", "Vinieron", "No vinieron", "Asistencia cerrada")


def _rows(summary: MonthlySummaryOut) -> list[tuple]:
    return [
        (
            activity.date.strftime("%d/%m/%Y"),
            safe(activity.title),
            activity.category_label,
            activity.came,
            activity.not_came,
            "Sí" if activity.closed else "No",
        )
        for activity in summary.activities
    ]


def to_csv(summary: MonthlySummaryOut) -> bytes:
    """CSV con BOM y punto y coma: Excel en español lo abre con tildes y columnas."""
    buffer = io.StringIO()
    writer = csv.writer(buffer, delimiter=";", lineterminator="\r\n")
    writer.writerow(HEADERS)
    writer.writerows(_rows(summary))
    writer.writerow(())
    writer.writerow(("Personas por tipo de actividad",))
    for category in summary.by_category:
        writer.writerow((category.label, category.came))
    writer.writerow(("Total de asistencias", summary.total_came))
    return ("﻿" + buffer.getvalue()).encode("utf-8")


def to_xlsx(summary: MonthlySummaryOut) -> bytes:
    workbook = Workbook()
    sheet = workbook.active
    sheet.title = f"Asistencia {summary.month}"
    sheet.append(HEADERS)
    for row in _rows(summary):
        sheet.append(row)
    sheet.append(())
    sheet.append(("Personas por tipo de actividad",))
    for category in summary.by_category:
        sheet.append((category.label, category.came))
    sheet.append(("Total de asistencias", summary.total_came))
    for cell in sheet[1]:
        cell.font = Font(bold=True)
    for column, width in zip("ABCDEF", (12, 36, 22, 10, 12, 18), strict=True):
        sheet.column_dimensions[column].width = width
    buffer = io.BytesIO()
    workbook.save(buffer)
    return buffer.getvalue()
