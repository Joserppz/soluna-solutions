"""Resumen mensual de donaciones en CSV (Excel en español) y Excel (.xlsx).

Dos partes: el resumen por canal y el detalle de cada aporte del mes, con su estado y
referencias, para conciliar con el extracto del banco.
"""

from app.core.spreadsheet import csv_bytes, safe, xlsx_bytes
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


def to_csv(summary: dict, donations: list[Donation]) -> bytes:
    return csv_bytes(
        [
            ("Resumen del mes",),
            SUMMARY_HEADERS,
            *_summary_rows(summary),
            (),
            ("Aportes del mes",),
            DETAIL_HEADERS,
            *_detail_rows(donations),
        ]
    )


def to_xlsx(summary: dict, donations: list[Donation]) -> bytes:
    return xlsx_bytes(
        [
            ("Resumen", SUMMARY_HEADERS, _summary_rows(summary)),
            ("Aportes", DETAIL_HEADERS, _detail_rows(donations)),
        ]
    )
