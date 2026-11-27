"""Resumen mensual de asistencia en Excel (.xlsx) y en PDF."""

import io

from openpyxl import Workbook
from openpyxl.styles import Font

from app.core import clock
from app.core.pdf import PdfReport, PdfTable, number, pdf_bytes
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


def to_pdf(summary: MonthlySummaryOut, author: str) -> bytes:
    """Personas por tipo de actividad en recuadros y cada actividad del mes debajo."""
    title = clock.month_title(summary.month)
    facts = [("Asistencias del mes", number(summary.total_came))]
    facts += [(category.label, number(category.came)) for category in summary.by_category]
    rows = [
        (
            activity.date,
            activity.title,
            activity.category_label,
            activity.came,
            activity.not_came,
            "Cerrada" if activity.closed else "Abierta",
        )
        for activity in summary.activities
    ]
    return pdf_bytes(
        PdfReport(
            title=f"Resumen de asistencia de {title}",
            filters=f"Mes: {title}",
            rows=len(rows),
            author=author,
            facts=facts,
            tables=[
                PdfTable(
                    ("Fecha", "Actividad", "Tipo", "Vinieron", "No vinieron", "Asistencia"),
                    rows,
                    heading="Actividades del mes",
                    empty="No hubo actividades este mes.",
                )
            ],
        )
    )


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
