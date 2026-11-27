"""Resumen mensual de donaciones en Excel (.xlsx) y en PDF.

Dos partes: el resumen por canal y el detalle de cada aporte del mes, con su estado y
referencias, para conciliar con el extracto del banco.
"""

from app.core.pdf import PdfReport, PdfTable, number, pdf_bytes
from app.core.reports import Sheet
from app.core.spreadsheet import safe, xlsx_bytes
from app.modules.donations.models import CHANNEL_LABELS, STATUS_LABELS, Donation

SUMMARY_HEADERS = ("Concepto", "Valor")
DETAIL_HEADERS = (
    "Fecha",
    "Donante",
    "Canal",
    "Monto (Bs.)",
    "En especie",
    "Estado",
    "Comprobante declarado",
    "Referencia del extracto",
    "Acreditado el",
    "Motivo de anulación",
)


def _summary_rows(summary: dict) -> list[tuple]:
    rows = [
        ("Mes", summary["month"]),
        ("Confirmado (Bs.)", summary["confirmed_bs"]),
        ("Aportes confirmados", summary["confirmed_count"]),
        ("Avisos por confirmar", summary["pending_count"]),
        ("Donaciones en especie", summary["in_kind_count"]),
        ("Anulados", summary["cancelled_count"]),
    ]
    rows += [(f"Confirmado por {c['label']} (Bs.)", c["amount_bs"]) for c in summary["by_channel"]]
    return rows


def _detail_rows(donations: list[Donation]) -> list[tuple]:
    return [
        (
            d.date.strftime("%d/%m/%Y"),
            safe(d.donor_name or "Anónimo"),
            CHANNEL_LABELS[d.channel],
            float(d.amount_bs) if d.amount_bs is not None else "",
            safe(d.in_kind_description or ""),
            STATUS_LABELS[d.status],
            safe(d.declared_reference or ""),
            safe(d.bank_reference or ""),
            d.credited_on.strftime("%d/%m/%Y") if d.credited_on else "",
            safe(d.cancellation_reason or ""),
        )
        for d in donations
    ]


def detail_sheet(donations: list[Donation]) -> Sheet:
    """Hoja del registro filtrado (la usa «Descargar» de la tabla de aportes)."""
    return Sheet(
        "Aportes",
        DETAIL_HEADERS,
        [
            [
                d.date,
                d.donor_name or "Anónimo",
                CHANNEL_LABELS[d.channel],
                float(d.amount_bs) if d.amount_bs is not None else None,
                d.in_kind_description,
                STATUS_LABELS[d.status],
                d.declared_reference,
                d.bank_reference,
                d.credited_on,
                d.cancellation_reason,
            ]
            for d in donations
        ],
    )


def to_pdf(summary: dict, donations: list[Donation], month_title: str, author: str) -> bytes:
    """El resumen en recuadros y, debajo, cada aporte del mes (para conciliar con el banco)."""
    facts = [
        ("Confirmado", f"Bs. {number(float(summary['confirmed_bs']))}"),
        ("Aportes confirmados", number(summary["confirmed_count"])),
        ("Por confirmar", number(summary["pending_count"])),
        ("En especie", number(summary["in_kind_count"])),
    ]
    facts += [
        (f"Por {c['label']}", f"Bs. {number(float(c['amount_bs']))}") for c in summary["by_channel"]
    ]
    if summary["cancelled_count"]:
        facts.append(("Anulados", number(summary["cancelled_count"])))
    headers = ("Fecha", "Donante", "Canal", "Monto (Bs.)", "Estado", "Referencia", "Detalle")
    rows = [
        (
            d.date,
            d.donor_name or "Anónimo",
            CHANNEL_LABELS[d.channel],
            float(d.amount_bs) if d.amount_bs is not None else None,
            STATUS_LABELS[d.status],
            d.bank_reference or d.declared_reference,
            d.in_kind_description or d.cancellation_reason,
        )
        for d in donations
    ]
    return pdf_bytes(
        PdfReport(
            title=f"Resumen de donaciones de {month_title}",
            filters=f"Mes: {month_title}",
            rows=len(rows),
            author=author,
            facts=facts,
            tables=[
                PdfTable(
                    headers, rows, heading="Aportes del mes", empty="No hubo aportes este mes."
                )
            ],
        )
    )


def to_xlsx(summary: dict, donations: list[Donation]) -> bytes:
    return xlsx_bytes(
        [
            ("Resumen", SUMMARY_HEADERS, _summary_rows(summary)),
            ("Aportes", DETAIL_HEADERS, _detail_rows(donations)),
        ]
    )
