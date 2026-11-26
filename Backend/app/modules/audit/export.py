"""Hoja de la descarga del registro de actividad."""

from app.core import clock
from app.core.reports import Sheet
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
        out.actor_name or "",
        entry.actor,
        entry.actor_role,
        out.area_label or "",
        entry.action,
        entry.detail,
        entry.occurrences,
        REVIEW_LABELS.get(out.review or "", ""),
    )


def sheet(entries: list[AuditLog], names: dict[str, str]) -> Sheet:
    return Sheet("Registro de actividad", HEADERS, [_row(entry, names) for entry in entries])
