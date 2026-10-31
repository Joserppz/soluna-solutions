import uuid

from fastapi import APIRouter, Depends, Query, status

from app.core.database import DbSession
from app.core.pagination import Pagination
from app.modules.auth.dependencies import CurrentUser, require_permission
from app.modules.patients import service as patient_service
from app.modules.patients.schemas import (
    PatientDeactivate,
    PatientIn,
    PatientOut,
    PatientPage,
    PatientUpdate,
    to_patient_out,
    to_patient_summary,
)
from app.modules.users.models import PATIENTS_DEACTIVATE, PATIENTS_READ, PATIENTS_WRITE

router = APIRouter(prefix="/api/v1/patients", tags=["Afiliados"])

staff = require_permission(PATIENTS_READ)
editors = require_permission(PATIENTS_WRITE)
admin_only = require_permission(PATIENTS_DEACTIVATE)


def _out(patient, current: CurrentUser) -> PatientOut:
    return to_patient_out(patient, patient_service.can_view_clinical_record(current, patient))


@router.get("", response_model=PatientPage, response_model_by_alias=True)
def list_patients(
    db: DbSession,
    page: Pagination,
    search: str | None = Query(default=None, max_length=120),
    access_status: str | None = Query(default=None, alias="status", max_length=20),
    include_inactive: bool = Query(default=False, alias="includeInactive"),
    current: CurrentUser = Depends(staff),
):
    result = patient_service.list_patients(db, search, access_status, include_inactive, page)
    return PatientPage.of(result, to_patient_summary)


@router.get("/{patient_id}", response_model=PatientOut, response_model_by_alias=True)
def get_patient(patient_id: uuid.UUID, db: DbSession, current: CurrentUser = Depends(staff)):
    patient, clinical_access = patient_service.view_patient(db, patient_id, current)
    return to_patient_out(patient, clinical_access)


@router.post(
    "",
    response_model=PatientOut,
    response_model_by_alias=True,
    status_code=status.HTTP_201_CREATED,
)
def create_patient(payload: PatientIn, db: DbSession, current: CurrentUser = Depends(editors)):
    return _out(patient_service.create_patient(db, payload, current), current)


@router.patch("/{patient_id}", response_model=PatientOut, response_model_by_alias=True)
def update_patient(
    patient_id: uuid.UUID,
    payload: PatientUpdate,
    db: DbSession,
    current: CurrentUser = Depends(editors),
):
    return _out(patient_service.update_patient(db, patient_id, payload, current), current)


@router.post("/{patient_id}/deactivate", response_model=PatientOut, response_model_by_alias=True)
def deactivate_patient(
    patient_id: uuid.UUID,
    payload: PatientDeactivate,
    db: DbSession,
    current: CurrentUser = Depends(admin_only),
):
    """Baja lógica con motivo: nada se elimina (reemplaza a DELETE /patients/{id})."""
    patient = patient_service.deactivate_patient(db, patient_id, payload.reason, current)
    return _out(patient, current)


@router.post("/{patient_id}/reactivate", response_model=PatientOut, response_model_by_alias=True)
def reactivate_patient(
    patient_id: uuid.UUID, db: DbSession, current: CurrentUser = Depends(admin_only)
):
    return _out(patient_service.reactivate_patient(db, patient_id, current), current)
