"""Resumen del panel (diseño pág. 7). Un contador es null si el rol no ve esa área."""

import datetime as dt
import uuid

from app.core.schemas import CamelModel


class ToReview(CamelModel):
    """«Para revisar»."""

    new_inquiries: int | None
    donations_to_confirm: int | None
    patients_without_consent: int | None
    damaged_items: int | None


class NextActivity(CamelModel):
    id: uuid.UUID
    title: str
    date: dt.date
    start_time: dt.time
    end_time: dt.time
    location: str
    professional_name: str
    # «27 personas suelen venir»: promedio de las últimas del mismo tipo
    usual_attendance: int | None
    # «Hay 3 inscripciones nuevas desde la semana pasada»
    new_signups: int


class UpcomingActivity(CamelModel):
    id: uuid.UUID
    title: str
    date: dt.date
    start_time: dt.time
    end_time: dt.time
    location: str
    status: str
    cancellation_note: str | None


class SaturdayAttendance(CamelModel):
    date: dt.date
    came: int


class PatientsOverview(CamelModel):
    active: int
    joined_this_month: int
    without_consent: int


class DashboardSummary(CamelModel):
    to_review: ToReview
    next_activity: NextActivity | None
    upcoming: list[UpcomingActivity] | None
    # Personas por sábado, los últimos 8 (el más antiguo primero)
    attendance_last_saturdays: list[SaturdayAttendance] | None
    patients: PatientsOverview | None
