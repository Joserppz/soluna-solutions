"""Fecha y hora de Bolivia (UTC-4, sin horario de verano).

El servidor corre en UTC: a las 21:00 de un sábado en La Paz ya es domingo en UTC.
Las reglas que dependen de "hoy" (asistencia, evaluaciones, agenda) usan esta hora.
"""

from datetime import date, datetime, timedelta, timezone

BOLIVIA = timezone(timedelta(hours=-4), "BOT")


def now() -> datetime:
    return datetime.now(BOLIVIA)


def today() -> date:
    return now().date()
