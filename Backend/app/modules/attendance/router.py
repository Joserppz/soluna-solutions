import uuid
from typing import Literal

from fastapi import APIRouter, Depends, Query, Response, status

from app.core.database import DbSession
from app.modules.attendance import export
from app.modules.attendance import service as attendance_service
from app.modules.attendance.schemas import (
    AttendanceActivity,
    AttendanceEntryOut,
    AttendanceMark,
    AttendanceSheetOut,
    AttendanceSummary,
    MonthlySummaryOut,
    NewcomerIn,
    NewcomerOut,
)
from app.modules.auth.dependencies import CurrentUser, require_permission
from app.modules.users.models import ATTENDANCE_WRITE, SCHEDULES_MANAGE

router = APIRouter(prefix="/api/v1/schedules/{schedule_id}/attendance", tags=["Asistencia"])
summary_router = APIRouter(prefix="/api/v1/attendance", tags=["Asistencia"])

takers = require_permission(ATTENDANCE_WRITE)
managers = require_permission(SCHEDULES_MANAGE)
readers = require_permission(ATTENDANCE_WRITE, SCHEDULES_MANAGE, any_of=True)

MEDIA_TYPES = {
    "csv": "text/csv; charset=utf-8",
    "xlsx": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
}


def _entry(patient, attendance) -> AttendanceEntryOut:
    return AttendanceEntryOut(
        patient_id=patient.id,
        name=patient.name,
        status=attendance.status if attendance else "sin_marcar",
        note=attendance.note if attendance else "",
        marked_at=attendance.marked_at if attendance else None,
    )


def _sheet(db: DbSession, schedule_id: uuid.UUID, search: str | None = None) -> AttendanceSheetOut:
    schedule, entries = attendance_service.sheet(db, schedule_id, search)
    return AttendanceSheetOut(
        activity=AttendanceActivity(
            id=schedule.id,
            title=schedule.title,
            date=schedule.date,
            start_time=schedule.start_time,
            end_time=schedule.end_time,
            location=schedule.location,
            professional_name=schedule.professional_name,
            status=schedule.status,
        ),
        closed=schedule.attendance_closed_at is not None,
        closed_at=schedule.attendance_closed_at,
        summary=AttendanceSummary(**attendance_service.summary(entries)),
        items=[_entry(patient, attendance) for patient, attendance in entries],
    )


@router.get("", response_model=AttendanceSheetOut, response_model_by_alias=True)
def get_sheet(
    schedule_id: uuid.UUID,
    db: DbSession,
    search: str | None = Query(default=None, max_length=120),
    current: CurrentUser = Depends(takers),
):
    """Lista del día: afiliados activos con lo que se marcó, por nombre."""
    return _sheet(db, schedule_id, search)


@router.put("/{patient_id}", response_model=AttendanceEntryOut, response_model_by_alias=True)
def mark(
    schedule_id: uuid.UUID,
    patient_id: uuid.UUID,
    payload: AttendanceMark,
    db: DbSession,
    current: CurrentUser = Depends(takers),
):
    """Vino / No vino / sin marcar, con una nota rápida opcional."""
    patient, attendance = attendance_service.mark(
        db, schedule_id, patient_id, payload.status, payload.note, current
    )
    return _entry(patient, attendance)


@router.post("/mark-all-present", response_model=AttendanceSheetOut, response_model_by_alias=True)
def mark_all_present(schedule_id: uuid.UUID, db: DbSession, current: CurrentUser = Depends(takers)):
    """«Marcar a todos como presentes»: solo cambia a quienes siguen sin marcar."""
    attendance_service.mark_all_present(db, schedule_id, current)
    return _sheet(db, schedule_id)


@router.post("/close", response_model=AttendanceSheetOut, response_model_by_alias=True)
def close(schedule_id: uuid.UUID, db: DbSession, current: CurrentUser = Depends(takers)):
    """«Cerrar asistencia del día»: después ya no se puede marcar."""
    attendance_service.close(db, schedule_id, current)
    return _sheet(db, schedule_id)


@router.post("/reopen", response_model=AttendanceSheetOut, response_model_by_alias=True)
def reopen(schedule_id: uuid.UUID, db: DbSession, current: CurrentUser = Depends(managers)):
    """Reabre una asistencia cerrada para corregirla (Coordinación)."""
    attendance_service.reopen(db, schedule_id, current)
    return _sheet(db, schedule_id)


@router.post(
    "/newcomers",
    response_model=NewcomerOut,
    response_model_by_alias=True,
    status_code=status.HTTP_201_CREATED,
)
def add_newcomer(
    schedule_id: uuid.UUID,
    payload: NewcomerIn,
    db: DbSession,
    current: CurrentUser = Depends(takers),
):
    """«Anotar persona nueva»: crea una solicitud (origen asistencia) para Recepción."""
    inquiry = attendance_service.add_newcomer(db, schedule_id, payload, current)
    return NewcomerOut(
        inquiry_id=inquiry.id,
        message="Anotada. Recepción abrirá su ficha y aparecerá en esta lista.",
    )


@summary_router.get(
    "/monthly",
    response_model=MonthlySummaryOut,
    response_model_by_alias=True,
    responses={
        200: {
            "content": {media: {} for media in MEDIA_TYPES.values()},
            "description": "JSON, o el archivo CSV / Excel con format=csv o format=xlsx",
        }
    },
)
def monthly_summary(
    db: DbSession,
    month: str | None = Query(default=None, pattern=r"^\d{4}-\d{2}$", examples=["2026-10"]),
    file_format: Literal["json", "csv", "xlsx"] = Query(default="json", alias="format"),
    current: CurrentUser = Depends(readers),
):
    """Resumen del mes por actividad y por tipo. Con format=csv o xlsx se descarga."""
    summary = attendance_service.monthly_summary(db, month)
    if file_format == "json":
        return summary
    content = export.to_csv(summary) if file_format == "csv" else export.to_xlsx(summary)
    return Response(
        content=content,
        media_type=MEDIA_TYPES[file_format],
        headers={
            "Content-Disposition": (
                f'attachment; filename="asistencia-{summary.month}.{file_format}"'
            )
        },
    )
