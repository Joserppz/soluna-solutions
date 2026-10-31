import datetime as dt
import uuid

from fastapi import APIRouter, Depends, Query, status

from app.core.database import DbSession
from app.core.pagination import Pagination
from app.core.schemas import MessageResponse
from app.modules.auth.dependencies import CurrentUser, require_permission
from app.modules.schedules import service as schedule_service
from app.modules.schedules.models import CATEGORY_LABELS, Schedule
from app.modules.schedules.schemas import (
    PublicScheduleOut,
    ScheduleCancel,
    ScheduleIn,
    ScheduleOut,
    SchedulePage,
    ScheduleStatus,
    ScheduleUpdate,
)
from app.modules.users.models import ATTENDANCE_WRITE, SCHEDULES_MANAGE

router = APIRouter(prefix="/api/v1/schedules", tags=["Actividades"])
public_router = APIRouter(prefix="/api/v1/public", tags=["Sitio público"])

# La agenda interna la ve quien gestiona actividades o quien toma asistencia
readers = require_permission(SCHEDULES_MANAGE, ATTENDANCE_WRITE, any_of=True)
managers = require_permission(SCHEDULES_MANAGE)


def to_schedule_out(schedule: Schedule, interested: int, came: int) -> ScheduleOut:
    return ScheduleOut(
        id=schedule.id,
        title=schedule.title,
        category=schedule.category,
        category_label=CATEGORY_LABELS[schedule.category],
        date=schedule.date,
        start_time=schedule.start_time,
        end_time=schedule.end_time,
        location=schedule.location,
        professional_id=schedule.professional_id,
        professional_name=schedule.professional_name,
        description=schedule.description,
        spots=schedule.spots,
        interested=interested,
        availability=schedule_service.availability(schedule.spots, interested),
        status=schedule.status,
        cancellation_note=schedule.cancellation_note,
        image_url=schedule.image_url,
        attendance_closed_at=schedule.attendance_closed_at,
        came=came,
        created_at=schedule.created_at,
        updated_at=schedule.updated_at,
    )


def _out(db: DbSession, schedule: Schedule) -> ScheduleOut:
    interested = schedule_service.interested(db, [schedule]).get(schedule.id, 0)
    came = schedule_service.came(db, [schedule]).get(schedule.id, 0)
    return to_schedule_out(schedule, interested, came)


@router.get("", response_model=SchedulePage, response_model_by_alias=True)
def list_schedules(
    db: DbSession,
    page: Pagination,
    date_from: dt.date | None = Query(default=None, alias="from"),
    date_to: dt.date | None = Query(default=None, alias="to"),
    status_filter: ScheduleStatus | None = Query(default=None, alias="status"),
    current: CurrentUser = Depends(readers),
):
    """Agenda interna (incluye borradores), por fecha y hora."""
    result = schedule_service.list_schedules(db, date_from, date_to, status_filter, page)
    interested = schedule_service.interested(db, result.items)
    came = schedule_service.came(db, result.items)
    return SchedulePage.of(
        result, lambda s: to_schedule_out(s, interested.get(s.id, 0), came.get(s.id, 0))
    )


@router.get("/{schedule_id}", response_model=ScheduleOut, response_model_by_alias=True)
def get_schedule(schedule_id: uuid.UUID, db: DbSession, current: CurrentUser = Depends(readers)):
    return _out(db, schedule_service.get_schedule(db, schedule_id))


@router.post(
    "",
    response_model=ScheduleOut,
    response_model_by_alias=True,
    status_code=status.HTTP_201_CREATED,
)
def create_schedule(payload: ScheduleIn, db: DbSession, current: CurrentUser = Depends(managers)):
    return _out(db, schedule_service.create_schedule(db, payload, current))


@router.patch("/{schedule_id}", response_model=ScheduleOut, response_model_by_alias=True)
def update_schedule(
    schedule_id: uuid.UUID,
    payload: ScheduleUpdate,
    db: DbSession,
    current: CurrentUser = Depends(managers),
):
    return _out(db, schedule_service.update_schedule(db, schedule_id, payload, current))


@router.post("/{schedule_id}/publish", response_model=ScheduleOut, response_model_by_alias=True)
def publish(schedule_id: uuid.UUID, db: DbSession, current: CurrentUser = Depends(managers)):
    """Borrador → publicada: aparece en el sitio."""
    return _out(db, schedule_service.publish(db, schedule_id, current))


@router.post("/{schedule_id}/unpublish", response_model=ScheduleOut, response_model_by_alias=True)
def unpublish(schedule_id: uuid.UUID, db: DbSession, current: CurrentUser = Depends(managers)):
    """Publicada → borrador: deja de verse en el sitio."""
    return _out(db, schedule_service.unpublish(db, schedule_id, current))


@router.post("/{schedule_id}/cancel", response_model=ScheduleOut, response_model_by_alias=True)
def cancel(
    schedule_id: uuid.UUID,
    payload: ScheduleCancel,
    db: DbSession,
    current: CurrentUser = Depends(managers),
):
    """Cancela con un aviso para el sitio (por ejemplo «Se reprogramará en diciembre»)."""
    return _out(db, schedule_service.cancel(db, schedule_id, payload.note, current))


@router.delete("/{schedule_id}", response_model=MessageResponse)
def delete(schedule_id: uuid.UUID, db: DbSession, current: CurrentUser = Depends(managers)):
    """Elimina un borrador. Una actividad publicada no se borra: se cancela."""
    schedule_service.delete(db, schedule_id, current)
    return MessageResponse(message="Borrador eliminado.")


@public_router.get(
    "/schedules", response_model=list[PublicScheduleOut], response_model_by_alias=True
)
def public_schedules(
    db: DbSession,
    date_from: dt.date | None = Query(default=None, alias="from"),
    date_to: dt.date | None = Query(default=None, alias="to"),
):
    """Agenda del sitio, sin iniciar sesión: actividades publicadas y canceladas.

    Por defecto desde hoy y por 90 días. No incluye borradores ni datos del equipo.
    """
    schedules = schedule_service.list_public(db, date_from, date_to)
    counts = schedule_service.interested(db, schedules)
    return [
        PublicScheduleOut(
            id=s.id,
            title=s.title,
            category=s.category,
            category_label=CATEGORY_LABELS[s.category],
            date=s.date,
            start_time=s.start_time,
            end_time=s.end_time,
            location=s.location,
            description=s.description,
            image_url=s.image_url,
            status=s.status,
            cancellation_note=s.cancellation_note,
            spots=s.spots,
            availability=schedule_service.availability(s.spots, counts.get(s.id, 0)),
        )
        for s in schedules
    ]
