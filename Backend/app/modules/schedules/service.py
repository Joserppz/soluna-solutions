"""Agenda de actividades (RF-04, diseño págs. 2, 3 y 12).

Estados: borrador (no se ve en el sitio) → publicada → cancelada (se sigue viendo,
tachada, con un aviso para que nadie llegue en vano). Solo los borradores se eliminan.
"""

import datetime as dt
import uuid

from sqlalchemy.orm import Session

from app.core import clock
from app.core.errors import Conflict, NotFound, ValidationError
from app.core.pagination import PageParams, PageResult
from app.modules.audit import service as audit_service
from app.modules.auth.dependencies import CurrentUser
from app.modules.schedules import repository as schedule_repository
from app.modules.schedules.models import PUBLIC_STATUSES, Schedule
from app.modules.schedules.schemas import ScheduleIn, ScheduleUpdate
from app.modules.users import repository as user_repository

NOT_FOUND = "Actividad no encontrada."
OLDEST_DATE = dt.date(2020, 1, 1)
PUBLIC_DEFAULT_DAYS = 90
PUBLIC_MAX_DAYS = 366
PUBLIC_LIMIT = 200


def availability(spots: int | None, interested: int) -> str | None:
    """«Cupos libres», «Últimos cupos» o «Completo» (informativo: no hay reservas)."""
    if spots is None:
        return None
    remaining = spots - interested
    if remaining <= 0:
        return "completo"
    if remaining <= max(2, spots // 5):
        return "ultimos"
    return "libres"


def get_schedule(db: Session, schedule_id: uuid.UUID) -> Schedule:
    schedule = schedule_repository.get(db, schedule_id)
    if schedule is None:
        raise NotFound(NOT_FOUND)
    return schedule


def interested(db: Session, schedules: list[Schedule]) -> dict[uuid.UUID, int]:
    return schedule_repository.interested_by_schedule(db, [s.id for s in schedules])


def list_schedules(
    db: Session,
    date_from: dt.date | None,
    date_to: dt.date | None,
    status: str | None,
    page: PageParams,
) -> PageResult:
    return schedule_repository.list_schedules(
        db, date_from, date_to, (status,) if status else None, page
    )


def list_public(db: Session, date_from: dt.date | None, date_to: dt.date | None) -> list[Schedule]:
    """Agenda del sitio: publicadas y canceladas, desde hoy y hasta 90 días por defecto."""
    start = date_from or clock.today()
    end = date_to or start + dt.timedelta(days=PUBLIC_DEFAULT_DAYS)
    if end < start:
        raise ValidationError("La fecha final debe ser posterior a la inicial.")
    if (end - start).days > PUBLIC_MAX_DAYS:
        raise ValidationError("Consulta como máximo un año de actividades.")
    return schedule_repository.list_public(db, start, end, PUBLIC_STATUSES, PUBLIC_LIMIT)


def _professional(
    db: Session, professional_id: uuid.UUID | None, professional_name: str
) -> tuple[uuid.UUID | None, str]:
    if professional_id is None:
        return None, professional_name.strip()
    user = user_repository.get_by_id(db, professional_id)
    if user is None or not user.active:
        raise ValidationError("La persona a cargo no existe o está desactivada.")
    return user.id, user.name


def _validate(schedule: Schedule) -> None:
    if len(schedule.title.strip()) < 3:
        raise ValidationError("El título debe tener al menos 3 caracteres.")
    if len(schedule.location.strip()) < 3:
        raise ValidationError("Indica el lugar de la actividad.")
    if schedule.end_time <= schedule.start_time:
        raise ValidationError("La hora de fin debe ser posterior a la de inicio.")
    if schedule.date < OLDEST_DATE:
        raise ValidationError("Revisa la fecha de la actividad.")
    if schedule.image_url and not schedule.image_url.startswith("https://"):
        raise ValidationError("La imagen debe ser un enlace https://.")


def _audit(
    db: Session,
    current: CurrentUser,
    schedule: Schedule,
    action: str,
    severity: str = "INFO",
    extra: str = "",
) -> None:
    audit_service.audit(
        db,
        current,
        category="CRONOGRAMA",
        severity=severity,
        action=action,
        detail=(
            f"{schedule.title} del {schedule.date:%d/%m/%Y} ({schedule.id}): "
            f"{schedule.status}{extra}"
        ),
    )


def create_schedule(db: Session, data: ScheduleIn, current: CurrentUser) -> Schedule:
    professional_id, professional_name = _professional(
        db, data.professional_id, data.professional_name
    )
    schedule = Schedule(
        title=data.title.strip(),
        category=data.category,
        date=data.date,
        start_time=data.start_time,
        end_time=data.end_time,
        location=data.location.strip(),
        professional_id=professional_id,
        professional_name=professional_name,
        description=data.description.strip(),
        spots=data.spots,
        image_url=(data.image_url or "").strip() or None,
        status="publicada" if data.publish else "borrador",
        created_by=current.user.id,
    )
    _validate(schedule)
    schedule = schedule_repository.add(db, schedule)
    _audit(db, current, schedule, "Creación de actividad")
    return schedule


def update_schedule(
    db: Session, schedule_id: uuid.UUID, data: ScheduleUpdate, current: CurrentUser
) -> Schedule:
    schedule = get_schedule(db, schedule_id)
    if schedule.status == "cancelada":
        raise Conflict("Una actividad cancelada no se edita: crea una nueva para reprogramarla.")
    changes = data.model_dump(exclude_unset=True)
    for field in ("title", "category", "date", "start_time", "end_time", "location"):
        if field in changes and changes[field] is None:
            raise ValidationError("No se puede dejar vacío un dato obligatorio de la actividad.")
    if "professional_id" in changes or "professional_name" in changes:
        schedule.professional_id, schedule.professional_name = _professional(
            db, changes.pop("professional_id", None), changes.pop("professional_name", None) or ""
        )
    for field, value in changes.items():
        if field in ("description",):
            value = (value or "").strip()
        elif field == "image_url":
            value = (value or "").strip() or None
        elif isinstance(value, str):
            value = value.strip()
        setattr(schedule, field, value)
    _validate(schedule)
    _audit(db, current, schedule, "Actualización de actividad")
    db.flush()
    db.refresh(schedule)
    return schedule


def publish(db: Session, schedule_id: uuid.UUID, current: CurrentUser) -> Schedule:
    schedule = get_schedule(db, schedule_id)
    if schedule.status != "borrador":
        raise Conflict("Solo se publica una actividad en borrador.")
    schedule.status = "publicada"
    _audit(db, current, schedule, "Publicación de actividad")
    db.flush()
    return schedule


def unpublish(db: Session, schedule_id: uuid.UUID, current: CurrentUser) -> Schedule:
    schedule = get_schedule(db, schedule_id)
    if schedule.status != "publicada":
        raise Conflict("Solo se puede volver a borrador una actividad publicada.")
    schedule.status = "borrador"
    _audit(db, current, schedule, "Actividad devuelta a borrador", "WARNING")
    db.flush()
    return schedule


def cancel(db: Session, schedule_id: uuid.UUID, note: str, current: CurrentUser) -> Schedule:
    schedule = get_schedule(db, schedule_id)
    if schedule.status == "cancelada":
        raise Conflict("La actividad ya está cancelada.")
    schedule.status = "cancelada"
    schedule.cancellation_note = note.strip()
    _audit(
        db,
        current,
        schedule,
        "Cancelación de actividad",
        "WARNING",
        f". Aviso: {schedule.cancellation_note}",
    )
    db.flush()
    return schedule


def delete(db: Session, schedule_id: uuid.UUID, current: CurrentUser) -> None:
    schedule = get_schedule(db, schedule_id)
    if schedule.status != "borrador":
        raise Conflict(
            "Solo se eliminan borradores. Una actividad publicada se cancela con un aviso."
        )
    _audit(db, current, schedule, "Eliminación de borrador de actividad", "WARNING")
    db.delete(schedule)
    db.flush()
