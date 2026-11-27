"""Fecha y hora de Bolivia (UTC-4, sin horario de verano).

El servidor corre en UTC: a las 21:00 de un sábado en La Paz ya es domingo en UTC.
Las reglas que dependen de "hoy" (asistencia, evaluaciones, agenda) usan esta hora.
"""

from datetime import date, datetime, timedelta, timezone

from app.core.errors import ValidationError

BOLIVIA = timezone(timedelta(hours=-4), "BOT")


MONTHS = (
    "enero",
    "febrero",
    "marzo",
    "abril",
    "mayo",
    "junio",
    "julio",
    "agosto",
    "septiembre",
    "octubre",
    "noviembre",
    "diciembre",
)


def month_title(month: str) -> str:
    """«2026-11» → «noviembre de 2026»."""
    year, number = month.split("-")
    return f"{MONTHS[int(number) - 1]} de {year}"


def now() -> datetime:
    return datetime.now(BOLIVIA)


def today() -> date:
    return now().date()


def month_range(month: str | None) -> tuple[str, date, date]:
    """«AAAA-MM» (o el mes actual en Bolivia) → (etiqueta, primer día, último día)."""
    if month is None:
        first = today().replace(day=1)
    else:
        try:
            first = datetime.strptime(month, "%Y-%m").date()
        except ValueError as exc:
            raise ValidationError(
                "El mes debe tener el formato AAAA-MM, por ejemplo 2026-10."
            ) from exc
    following = (first.replace(day=28) + timedelta(days=4)).replace(day=1)
    return f"{first:%Y-%m}", first, following - timedelta(days=1)
