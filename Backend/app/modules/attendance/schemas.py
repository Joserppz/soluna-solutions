"""DTOs de la toma de asistencia y del resumen mensual (camelCase)."""

import datetime as dt
import uuid
from typing import Literal

from pydantic import Field

from app.core.schemas import CamelModel
from app.modules.attendance.models import STATUSES

AttendanceStatus = Literal[STATUSES]


class AttendanceMark(CamelModel):
    status: AttendanceStatus
    # Si se omite, la nota anterior se conserva
    note: str | None = Field(default=None, max_length=300)


class AttendanceEntryOut(CamelModel):
    patient_id: uuid.UUID
    name: str
    status: AttendanceStatus
    note: str
    marked_at: dt.datetime | None


class AttendanceSummary(CamelModel):
    came: int
    not_came: int
    unmarked: int
    total: int


class AttendanceActivity(CamelModel):
    id: uuid.UUID
    title: str
    date: dt.date
    start_time: dt.time
    end_time: dt.time
    location: str
    professional_name: str
    status: str


class AttendanceSheetOut(CamelModel):
    """La planilla del día: quiénes están en la lista y qué se marcó."""

    activity: AttendanceActivity
    closed: bool
    closed_at: dt.datetime | None
    summary: AttendanceSummary
    items: list[AttendanceEntryOut]


class NewcomerIn(CamelModel):
    """Persona que llegó por primera vez y no tiene ficha («Anotar persona nueva»)."""

    name: str = Field(max_length=120)
    phone: str = Field(max_length=12)
    # Si vino por otra persona (por ejemplo, la hija de quien tiene Parkinson)
    on_behalf_of: str = Field(default="", max_length=120)
    note: str = Field(default="", max_length=1000)
    # La persona aceptó que el equipo la llame para abrir su ficha
    contact_consent: bool = False


class NewcomerOut(CamelModel):
    inquiry_id: uuid.UUID
    message: str


class MonthlyActivity(CamelModel):
    schedule_id: uuid.UUID
    date: dt.date
    title: str
    category_label: str
    came: int
    not_came: int
    closed: bool


class MonthlyCategory(CamelModel):
    category: str
    label: str
    came: int


class MonthlySummaryOut(CamelModel):
    month: str
    activities: list[MonthlyActivity]
    # «Personas por actividad» del diseño (pág. 10)
    by_category: list[MonthlyCategory]
    total_came: int
