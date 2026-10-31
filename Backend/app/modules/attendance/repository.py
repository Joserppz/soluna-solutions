import datetime as dt
import uuid

from sqlalchemy import func, or_, select, update
from sqlalchemy.dialects.postgresql import insert
from sqlalchemy.orm import Session

from app.modules.attendance.models import MARKED, Attendance
from app.modules.patients.models import Patient
from app.modules.schedules.models import Schedule


def roster(db: Session, schedule_id: uuid.UUID) -> list[tuple[Patient, Attendance | None]]:
    """Afiliados activos más los que ya tienen asistencia en esta actividad, por nombre."""
    rows = db.execute(
        select(Patient, Attendance)
        .outerjoin(
            Attendance,
            (Attendance.patient_id == Patient.id) & (Attendance.schedule_id == schedule_id),
        )
        .where(or_(Patient.deleted_at.is_(None), Attendance.id.is_not(None)))
        .order_by(Patient.name, Patient.id)
    )
    return [(patient, attendance) for patient, attendance in rows.all()]


def get(db: Session, schedule_id: uuid.UUID, patient_id: uuid.UUID) -> Attendance | None:
    return db.scalar(
        select(Attendance).where(
            Attendance.schedule_id == schedule_id, Attendance.patient_id == patient_id
        )
    )


def ensure_rows(db: Session, schedule_id: uuid.UUID, patient_ids: list[uuid.UUID]) -> None:
    """Crea las filas que falten sin fallar si otra persona las creó al mismo tiempo.

    Dos voluntarios pueden marcar a la misma persona a la vez desde sus celulares:
    ON CONFLICT evita que el segundo choque con la restricción única.
    """
    if not patient_ids:
        return
    db.execute(
        insert(Attendance)
        .values([{"schedule_id": schedule_id, "patient_id": pid} for pid in patient_ids])
        .on_conflict_do_nothing(index_elements=["schedule_id", "patient_id"])
    )


def lock(db: Session, schedule_id: uuid.UUID, patient_id: uuid.UUID) -> Attendance:
    return db.scalars(
        select(Attendance)
        .where(Attendance.schedule_id == schedule_id, Attendance.patient_id == patient_id)
        .with_for_update()
        .execution_options(populate_existing=True)
    ).one()


def mark_unmarked_as_present(
    db: Session, schedule_id: uuid.UUID, user_id: uuid.UUID, when: dt.datetime
) -> int:
    result = db.execute(
        update(Attendance)
        .where(Attendance.schedule_id == schedule_id, Attendance.status == "sin_marcar")
        .values(status="vino", marked_by=user_id, marked_at=when)
        .execution_options(synchronize_session=False)
    )
    db.expire_all()
    return result.rowcount


def count_marked(db: Session, schedule_id: uuid.UUID) -> int:
    return db.scalar(
        select(func.count())
        .select_from(Attendance)
        .where(Attendance.schedule_id == schedule_id, Attendance.status.in_(MARKED))
    )


def count_rows(db: Session, schedule_id: uuid.UUID) -> int:
    return db.scalar(
        select(func.count()).select_from(Attendance).where(Attendance.schedule_id == schedule_id)
    )


def came_by_schedule(db: Session, schedule_ids: list[uuid.UUID]) -> dict[uuid.UUID, int]:
    if not schedule_ids:
        return {}
    rows = db.execute(
        select(Attendance.schedule_id, func.count())
        .where(Attendance.schedule_id.in_(schedule_ids), Attendance.status == "vino")
        .group_by(Attendance.schedule_id)
    )
    return dict(rows.all())


def monthly(db: Session, first: dt.date, last: dt.date) -> list[tuple[Schedule, int, int]]:
    """Actividades publicadas del mes con cuántos vinieron y cuántos no."""
    came = func.count().filter(Attendance.status == "vino")
    not_came = func.count().filter(Attendance.status == "no_vino")
    rows = db.execute(
        select(Schedule, came, not_came)
        .outerjoin(Attendance, Attendance.schedule_id == Schedule.id)
        .where(Schedule.date >= first, Schedule.date <= last, Schedule.status == "publicada")
        .group_by(Schedule.id)
        .order_by(Schedule.date, Schedule.start_time, Schedule.id)
    )
    return [(schedule, c, n) for schedule, c, n in rows.all()]
