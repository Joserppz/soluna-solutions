"""Descarga del registro de actividad (CSV para Excel en español o .xlsx)."""

from app.core import clock
from app.core.spreadsheet import csv_bytes, safe, xlsx_bytes
from app.modules.audit.models import AuditLog
from app.modules.audit.schemas import to_audit_out

HEADERS = (
    "Fecha",
    "Hora",
    "Persona",
    "Correo",
    "Rol",
    "Área",
    "Acción",
    "Detalle",
    "Repeticiones",
    "Para revisar",
)
REVIEW_LABELS = {"acceso_bloqueado": "Acceso bloqueado", "aporte_anulado": "Aporte anulado"}


def _row(entry: AuditLog, names: dict[str, str]) -> tuple:
    out = to_audit_out(entry, names)
    when = entry.date.astimezone(clock.BOLIVIA)
    return (
        when.strftime("%d/%m/%Y"),
        when.strftime("%H:%M"),
        safe(out.actor_name or ""),
        safe(entry.actor),
        safe(entry.actor_role),
        out.area_label or "",
        safe(entry.action),
        safe(entry.detail),
        entry.occurrences,
        REVIEW_LABELS.get(out.review or "", ""),
    )


def to_csv(entries: list[AuditLog], names: dict[str, str]) -> bytes:
    return csv_bytes([HEADERS, *(_row(entry, names) for entry in entries)])


def to_xlsx(entries: list[AuditLog], names: dict[str, str]) -> bytes:
    return xlsx_bytes([("Registro de actividad", HEADERS, [_row(e, names) for e in entries])])
