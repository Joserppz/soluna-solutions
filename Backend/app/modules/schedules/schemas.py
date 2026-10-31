"""DTOs de la agenda de actividades (camelCase)."""

import datetime as dt
import uuid
from typing import Literal

from pydantic import Field

from app.core.pagination import Page
from app.core.schemas import CamelModel
from app.modules.schedules.models import CATEGORIES, STATUSES

ScheduleCategory = Literal[CATEGORIES]
ScheduleStatus = Literal[STATUSES]
# Cupos informativos según las solicitudes «Quiero participar» abiertas
Availability = Literal["libres", "ultimos", "completo"]


class ScheduleIn(CamelModel):
    title: str = Field(max_length=120)
    category: ScheduleCategory
    date: dt.date
    start_time: dt.time
    end_time: dt.time
    location: str = Field(max_length=120)
    # Profesional a cargo: una cuenta del equipo o un nombre libre («Coordinación»)
    professional_id: uuid.UUID | None = None
    professional_name: str = Field(default="", max_length=120)
    description: str = Field(default="", max_length=1000)
    spots: int | None = Field(default=None, ge=0, le=500)
    image_url: str | None = Field(default=None, max_length=500)
    # true: se crea ya publicada; false: queda como borrador (no se ve en el sitio)
    publish: bool = False


class ScheduleUpdate(CamelModel):
    title: str | None = Field(default=None, max_length=120)
    category: ScheduleCategory | None = None
    date: dt.date | None = None
    start_time: dt.time | None = None
    end_time: dt.time | None = None
    location: str | None = Field(default=None, max_length=120)
    professional_id: uuid.UUID | None = None
    professional_name: str | None = Field(default=None, max_length=120)
    description: str | None = Field(default=None, max_length=1000)
    spots: int | None = Field(default=None, ge=0, le=500)
    image_url: str | None = Field(default=None, max_length=500)


class ScheduleCancel(CamelModel):
    # Aviso que se ve en el sitio, por ejemplo «Se reprogramará en diciembre»
    note: str = Field(min_length=3, max_length=300)


class ScheduleOut(CamelModel):
    id: uuid.UUID
    title: str
    category: ScheduleCategory
    category_label: str
    date: dt.date
    start_time: dt.time
    end_time: dt.time
    location: str
    professional_id: uuid.UUID | None
    professional_name: str
    description: str
    spots: int | None
    # Solicitudes «Quiero participar» abiertas para esta actividad
    interested: int
    availability: Availability | None
    status: ScheduleStatus
    cancellation_note: str | None
    image_url: str | None
    attendance_closed_at: dt.datetime | None
    # Afiliados marcados como «Vino»
    came: int
    created_at: dt.datetime
    updated_at: dt.datetime


class SchedulePage(Page[ScheduleOut]):
    """Página de la agenda interna."""


class PublicScheduleOut(CamelModel):
    """Lo que se ve en el sitio sin iniciar sesión: sin datos del equipo."""

    id: uuid.UUID
    title: str
    category: ScheduleCategory
    category_label: str
    date: dt.date
    start_time: dt.time
    end_time: dt.time
    location: str
    description: str
    image_url: str | None
    status: Literal["publicada", "cancelada"]
    cancellation_note: str | None
    spots: int | None
    availability: Availability | None
