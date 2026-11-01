import datetime as dt
import uuid
from collections import defaultdict

from sqlalchemy import exists, func, or_, select
from sqlalchemy.orm import Session

from app.core.database import escape_like
from app.core.pagination import PageParams, PageResult, paginate
from app.modules.attendance.models import Attendance
from app.modules.patients.models import Patient
from app.modules.schedules.models import Schedule

# Pestañas del listado (diseño pág. 8). Las fichas inactivas son las dadas de baja.
GROUPS = ("all", "active", "consent_pending", "inactive")
# Órdenes del listado; el id al final da un orden total: las páginas no repiten fichas
ORDERS = {
    "name": (func.lower(Patient.name).asc(), Patient.id.asc()),
    "-name": (func.lower(Patient.name).desc(), Patient.id.desc()),
    "recent": (Patient.created_at.desc(), Patient.id.desc()),
    "oldest": (Patient.created_at.asc(), Patient.id.asc()),
}


def _attended(category: str, since: dt.date):
    """El afiliado vino al menos una vez a una actividad de esa categoría desde «since»."""
    return exists(
        select(Attendance.id)
        .join(Schedule, Schedule.id == Attendance.schedule_id)
        .where(
            Attendance.patient_id == Patient.id,
            Attendance.status == "vino",
            Schedule.category == category,
            Schedule.date >= since,
        )
    )


def _filtered(query, search: str | None, activity: str | None, since: dt.date | None):
    if search:
        pattern = f"%{escape_like(search.strip())}%"
        query = query.where(
            or_(Patient.name.ilike(pattern, escape="\\"), Patient.ci.ilike(pattern, escape="\\"))
        )
    if activity and since is not None:
        query = query.where(_attended(activity, since))
    return query


def list_patients(
    db: Session,
    search: str | None = None,
    access_status: str | None = None,
    include_inactive: bool = False,
    page: PageParams | None = None,
    *,
    group: str | None = None,
    activity: str | None = None,
    since: dt.date | None = None,
    order: str = "recent",
) -> PageResult:
    query = _filtered(select(Patient), search, activity, since).order_by(*ORDERS[order])
    if group == "active":
        query = query.where(Patient.deleted_at.is_(None))
    elif group == "consent_pending":
        query = query.where(Patient.deleted_at.is_(None), Patient.consent.is_(False))
    elif group == "inactive":
        query = query.where(Patient.deleted_at.is_not(None))
    elif group is None and not include_inactive:
        query = query.where(Patient.deleted_at.is_(None))
    if access_status:
        query = query.where(Patient.access_status == access_status)
    return paginate(db, query, page or PageParams())


def counts(
    db: Session, search: str | None, activity: str | None, since: dt.date | None
) -> dict[str, int]:
    """Cuántas fichas hay en cada pestaña, con la misma búsqueda y actividad del listado."""
    active = Patient.deleted_at.is_(None)
    row = db.execute(
        _filtered(
            select(
                func.count(),
                func.count().filter(active),
                func.count().filter(active, Patient.consent.is_(False)),
                func.count().filter(Patient.deleted_at.is_not(None)),
            ).select_from(Patient),
            search,
            activity,
            since,
        )
    ).one()
    return dict(zip(GROUPS, row, strict=True))


def activities_by_patient(
    db: Session, patient_ids: list[uuid.UUID], since: dt.date
) -> dict[uuid.UUID, list[str]]:
    """Categorías de las actividades a las que vino cada afiliado, de la más frecuente."""
    if not patient_ids:
        return {}
    visits = func.count()
    rows = db.execute(
        select(Attendance.patient_id, Schedule.category, visits)
        .join(Schedule, Schedule.id == Attendance.schedule_id)
        .where(
            Attendance.patient_id.in_(patient_ids),
            Attendance.status == "vino",
            Schedule.date >= since,
        )
        .group_by(Attendance.patient_id, Schedule.category)
        .order_by(Attendance.patient_id, visits.desc(), Schedule.category)
    )
    result: dict[uuid.UUID, list[str]] = defaultdict(list)
    for patient_id, category, _ in rows.all():
        result[patient_id].append(category)
    return result


def patients_by_activity(db: Session, since: dt.date) -> dict[str, int]:
    """Cuántas fichas activas vinieron a cada categoría de actividad desde «since»."""
    rows = db.execute(
        select(Schedule.category, func.count(func.distinct(Attendance.patient_id)))
        .join(Attendance, Attendance.schedule_id == Schedule.id)
        .join(Patient, Patient.id == Attendance.patient_id)
        .where(
            Attendance.status == "vino",
            Schedule.date >= since,
            Patient.deleted_at.is_(None),
        )
        .group_by(Schedule.category)
    )
    return dict(rows.all())


def get_by_id(db: Session, patient_id: uuid.UUID) -> Patient | None:
    return db.get(Patient, patient_id)


def get_by_ci(db: Session, ci: str) -> Patient | None:
    return db.scalar(select(Patient).where(func.lower(Patient.ci) == ci.strip().lower()))


def add(db: Session, patient: Patient) -> Patient:
    db.add(patient)
    db.flush()
    db.refresh(patient)
    return patient
