"""Toma de asistencia de los sábados (RF-12, diseño págs. 3 y 10).

El voluntariado marca quién vino desde el celular. La lista son los afiliados activos
(más quien ya tenga asistencia en esa actividad). Solo se toma en actividades
publicadas cuya fecha ya llegó (hora de Bolivia) y hasta cerrar la asistencia del día.
"""

import datetime as dt
import re
import uuid
from collections import defaultdict

from sqlalchemy.orm import Session

from app.core import clock
from app.core.errors import Conflict, NotFound, ValidationError
from app.modules.attendance import repository as attendance_repository
from app.modules.attendance.models import Attendance
from app.modules.attendance.schemas import (
    MonthlyActivity,
    MonthlyCategory,
    MonthlySummaryOut,
    NewcomerIn,
)
from app.modules.audit import service as audit_service
from app.modules.auth.dependencies import CurrentUser
from app.modules.inquiries.models import Inquiry
from app.modules.patients.models import Patient
from app.modules.schedules.models import CATEGORY_LABELS, Schedule
from app.modules.schedules.service import get_schedule

PHONE_PATTERN = re.compile(r"^\d{7,12}$")
NOT_IN_LIST = "Esa persona no está en la lista de asistencia (su ficha está dada de baja)."


def _check_open(schedule: Schedule, allow_closed: bool = False) -> None:
    if schedule.status == "borrador":
        raise Conflict("La actividad todavía es un borrador: publícala para tomar asistencia.")
    if schedule.status == "cancelada":
        raise Conflict("La actividad fue cancelada: no hay asistencia que tomar.")
    if schedule.date > clock.today():
        raise Conflict("La asistencia se toma el día de la actividad.")
    if schedule.attendance_closed_at is not None and not allow_closed:
        raise Conflict("La asistencia de este día ya se cerró.")


def _audit(db: Session, current: CurrentUser, schedule: Schedule, action: str, detail: str):
    audit_service.audit(
        db,
        current,
        category="ASISTENCIA",
        action=action,
        detail=f"{detail} — {schedule.title} del {schedule.date:%d/%m/%Y} ({schedule.id})",
    )


def sheet(
    db: Session, schedule_id: uuid.UUID, search: str | None = None
) -> tuple[Schedule, list[tuple[Patient, Attendance | None]]]:
    schedule = get_schedule(db, schedule_id)
    entries = attendance_repository.roster(db, schedule.id)
    if search and search.strip():
        term = search.strip().lower()
        entries = [(p, a) for p, a in entries if term in p.name.lower()]
    return schedule, entries


def summary(entries: list[tuple[Patient, Attendance | None]]) -> dict[str, int]:
    statuses = [attendance.status if attendance else "sin_marcar" for _, attendance in entries]
    return {
        "came": statuses.count("vino"),
        "not_came": statuses.count("no_vino"),
        "unmarked": statuses.count("sin_marcar"),
        "total": len(statuses),
    }


def _row(db: Session, schedule: Schedule, patient_id: uuid.UUID) -> tuple[Patient, Attendance]:
    patient = db.get(Patient, patient_id)
    if patient is None:
        raise NotFound("Afiliado no encontrado.")
    if attendance_repository.get(db, schedule.id, patient.id) is None:
        if not patient.active:
            raise Conflict(NOT_IN_LIST)
        attendance_repository.ensure_rows(db, schedule.id, [patient.id])
    return patient, attendance_repository.lock(db, schedule.id, patient.id)


def mark(
    db: Session,
    schedule_id: uuid.UUID,
    patient_id: uuid.UUID,
    status: str,
    note: str | None,
    current: CurrentUser,
) -> tuple[Patient, Attendance]:
    """Se guarda solo al marcar (diseño pág. 10): una persona, un toque."""
    schedule = get_schedule(db, schedule_id)
    _check_open(schedule)
    patient, attendance = _row(db, schedule, patient_id)
    attendance.status = status
    if note is not None:
        attendance.note = note.strip()
    attendance.marked_by = current.user.id if status != "sin_marcar" else None
    attendance.marked_at = clock.now() if status != "sin_marcar" else None
    db.flush()
    return patient, attendance


def mark_all_present(db: Session, schedule_id: uuid.UUID, current: CurrentUser) -> int:
    """«Marcar a todos como presentes»: solo quienes siguen sin marcar (no pisa un «No vino»)."""
    schedule = get_schedule(db, schedule_id)
    _check_open(schedule)
    missing = [
        patient.id
        for patient, attendance in attendance_repository.roster(db, schedule.id)
        if attendance is None
    ]
    attendance_repository.ensure_rows(db, schedule.id, missing)
    marked = attendance_repository.mark_unmarked_as_present(
        db, schedule.id, current.user.id, clock.now()
    )
    _audit(db, current, schedule, "Asistencia: todos presentes", f"Marcó {marked} como presentes")
    db.flush()
    return marked


def close(db: Session, schedule_id: uuid.UUID, current: CurrentUser) -> Schedule:
    schedule = get_schedule(db, schedule_id)
    _check_open(schedule)
    schedule.attendance_closed_at = clock.now()
    schedule.attendance_closed_by = current.user.id
    vino = attendance_repository.came_by_schedule(db, [schedule.id]).get(schedule.id, 0)
    _audit(db, current, schedule, "Cierre de asistencia del día", f"Cerró con {vino} presentes")
    db.flush()
    return schedule


def reopen(db: Session, schedule_id: uuid.UUID, current: CurrentUser) -> Schedule:
    schedule = get_schedule(db, schedule_id)
    if schedule.attendance_closed_at is None:
        raise Conflict("La asistencia de esta actividad no está cerrada.")
    schedule.attendance_closed_at = None
    schedule.attendance_closed_by = None
    audit_service.audit(
        db,
        current,
        category="ASISTENCIA",
        severity="WARNING",
        action="Reapertura de asistencia",
        detail=f"Reabrió la asistencia de {schedule.title} del {schedule.date:%d/%m/%Y}",
    )
    db.flush()
    return schedule


def add_newcomer(
    db: Session, schedule_id: uuid.UUID, data: NewcomerIn, current: CurrentUser
) -> Inquiry:
    """«Anotar persona nueva»: crea una solicitud para que Recepción abra su ficha."""
    schedule = get_schedule(db, schedule_id)
    _check_open(schedule, allow_closed=True)
    name, phone = data.name.strip(), data.phone.strip()
    if len(name) < 3:
        raise ValidationError("Escribe el nombre de la persona (al menos 3 caracteres).")
    if not PHONE_PATTERN.match(phone):
        raise ValidationError("El teléfono debe tener entre 7 y 12 dígitos.")
    inquiry = Inquiry(
        kind="asistencia",
        source="asistencia",
        name=name,
        phone=phone,
        on_behalf_of=data.on_behalf_of.strip(),
        message=data.note.strip(),
        schedule_id=schedule.id,
        status="recibida",
        contact_consent=data.contact_consent,
    )
    db.add(inquiry)
    db.flush()
    audit_service.audit(
        db,
        current,
        category="SOLICITUDES",
        action="Persona nueva anotada en asistencia",
        detail=(
            f"Anotó a {name} en {schedule.title} del {schedule.date:%d/%m/%Y}; "
            f"solicitud {inquiry.id} para Recepción"
        ),
    )
    return inquiry


def parse_month(month: str | None) -> tuple[str, dt.date, dt.date]:
    if month is None:
        first = clock.today().replace(day=1)
    else:
        try:
            first = dt.datetime.strptime(month, "%Y-%m").date()
        except ValueError as exc:
            raise ValidationError(
                "El mes debe tener el formato AAAA-MM, por ejemplo 2026-10."
            ) from exc
    following = (first.replace(day=28) + dt.timedelta(days=4)).replace(day=1)
    return f"{first:%Y-%m}", first, following - dt.timedelta(days=1)


def monthly_summary(db: Session, month: str | None) -> MonthlySummaryOut:
    label, first, last = parse_month(month)
    activities = []
    by_category: dict[str, int] = defaultdict(int)
    for schedule, came, not_came in attendance_repository.monthly(db, first, last):
        activities.append(
            MonthlyActivity(
                schedule_id=schedule.id,
                date=schedule.date,
                title=schedule.title,
                category_label=CATEGORY_LABELS[schedule.category],
                came=came,
                not_came=not_came,
                closed=schedule.attendance_closed_at is not None,
            )
        )
        by_category[schedule.category] += came
    return MonthlySummaryOut(
        month=label,
        activities=activities,
        by_category=[
            MonthlyCategory(category=key, label=CATEGORY_LABELS[key], came=total)
            for key, total in sorted(by_category.items(), key=lambda item: -item[1])
        ],
        total_came=sum(by_category.values()),
    )
