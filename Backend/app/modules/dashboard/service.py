"""Resumen del panel (diseño pág. 7): lo que necesita atención esta semana.

Cada bloque se calcula solo si el rol tiene el permiso de esa área: el voluntariado
no ve los aportes por confirmar y Recepción no ve el inventario.
"""

import datetime as dt

from sqlalchemy import func, select
from sqlalchemy.orm import Session

from app.core import clock
from app.modules.attendance.models import Attendance
from app.modules.auth.dependencies import CurrentUser
from app.modules.donations.models import Donation
from app.modules.inquiries.models import Inquiry
from app.modules.inventory.models import InventoryItem
from app.modules.patients.models import Patient
from app.modules.schedules.models import Schedule
from app.modules.users.models import (
    ATTENDANCE_WRITE,
    DONATIONS_MANAGE,
    INQUIRIES_MANAGE,
    INVENTORY_MANAGE,
    PATIENTS_READ,
    SCHEDULES_MANAGE,
)

UPCOMING_LIMIT = 4
SATURDAYS = 8
USUAL_SAMPLE = 4


def _count(db: Session, query) -> int:
    return db.scalar(select(func.count()).select_from(query.subquery()))


def to_review(db: Session, current: CurrentUser) -> dict:
    active_patients = select(Patient.id).where(Patient.deleted_at.is_(None))
    return {
        "new_inquiries": (
            _count(db, select(Inquiry.id).where(Inquiry.status == "recibida"))
            if current.can(INQUIRIES_MANAGE)
            else None
        ),
        "donations_to_confirm": (
            _count(db, select(Donation.id).where(Donation.status == "pendiente"))
            if current.can(DONATIONS_MANAGE)
            else None
        ),
        "patients_without_consent": (
            _count(db, active_patients.where(Patient.consent.is_(False)))
            if current.can(PATIENTS_READ)
            else None
        ),
        "damaged_items": (
            _count(
                db,
                select(InventoryItem.id).where(
                    InventoryItem.deleted_at.is_(None), InventoryItem.condition == "dañado"
                ),
            )
            if current.can(INVENTORY_MANAGE)
            else None
        ),
    }


def _came(db: Session, schedule_ids: list) -> dict:
    if not schedule_ids:
        return {}
    rows = db.execute(
        select(Attendance.schedule_id, func.count())
        .where(Attendance.schedule_id.in_(schedule_ids), Attendance.status == "vino")
        .group_by(Attendance.schedule_id)
    )
    return dict(rows.all())


def next_activity(db: Session, today: dt.date) -> dict | None:
    schedule = db.scalar(
        select(Schedule)
        .where(Schedule.status == "publicada", Schedule.date >= today)
        .order_by(Schedule.date, Schedule.start_time, Schedule.id)
        .limit(1)
    )
    if schedule is None:
        return None
    previous = list(
        db.scalars(
            select(Schedule)
            .where(
                Schedule.status == "publicada",
                Schedule.category == schedule.category,
                Schedule.date < today,
            )
            .order_by(Schedule.date.desc())
            .limit(USUAL_SAMPLE)
        )
    )
    came = [c for c in _came(db, [s.id for s in previous]).values() if c]
    week_ago = clock.now() - dt.timedelta(days=7)
    signups = _count(
        db,
        select(Inquiry.id).where(
            Inquiry.schedule_id == schedule.id,
            Inquiry.kind == "participar",
            Inquiry.created_at >= week_ago,
        ),
    )
    return {
        "id": schedule.id,
        "title": schedule.title,
        "date": schedule.date,
        "start_time": schedule.start_time,
        "end_time": schedule.end_time,
        "location": schedule.location,
        "professional_name": schedule.professional_name,
        "usual_attendance": round(sum(came) / len(came)) if came else None,
        "new_signups": signups,
    }


def upcoming(db: Session, today: dt.date) -> list[Schedule]:
    return list(
        db.scalars(
            select(Schedule)
            .where(Schedule.date >= today)
            .order_by(Schedule.date, Schedule.start_time, Schedule.id)
            .limit(UPCOMING_LIMIT)
        )
    )


def last_saturdays(db: Session, today: dt.date) -> list[dict]:
    last = today - dt.timedelta(days=(today.weekday() - 5) % 7)
    days = [last - dt.timedelta(weeks=n) for n in range(SATURDAYS - 1, -1, -1)]
    rows = db.execute(
        select(Schedule.date, func.count())
        .join(Attendance, Attendance.schedule_id == Schedule.id)
        .where(Schedule.date.in_(days), Attendance.status == "vino")
        .group_by(Schedule.date)
    )
    came = dict(rows.all())
    return [{"date": day, "came": came.get(day, 0)} for day in days]


def patients_overview(db: Session, today: dt.date) -> dict:
    active = select(Patient.id).where(Patient.deleted_at.is_(None))
    first_of_month = dt.datetime.combine(today.replace(day=1), dt.time(), tzinfo=clock.BOLIVIA)
    return {
        "active": _count(db, active),
        "joined_this_month": _count(db, active.where(Patient.created_at >= first_of_month)),
        "without_consent": _count(db, active.where(Patient.consent.is_(False))),
    }


def summary(db: Session, current: CurrentUser) -> dict:
    today = clock.today()
    sees_agenda = current.can(SCHEDULES_MANAGE) or current.can(ATTENDANCE_WRITE)
    return {
        "to_review": to_review(db, current),
        "next_activity": next_activity(db, today) if sees_agenda else None,
        "upcoming": upcoming(db, today) if sees_agenda else None,
        "attendance_last_saturdays": last_saturdays(db, today) if sees_agenda else None,
        "patients": patients_overview(db, today) if current.can(PATIENTS_READ) else None,
    }
