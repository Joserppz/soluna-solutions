from fastapi import APIRouter, Depends, Query, status
from sqlalchemy.orm import Session

from app.core.constants import PATIENT_EDITOR_ROLES
from app.core.database import get_db
from app.core.deps import CurrentUser, get_current_user, require_roles
from app.schemas.auth import MessageResponse
from app.schemas.patient import PatientIn, PatientOut, PatientUpdate, to_patient_out
from app.services import patient_service

router = APIRouter(prefix="/api/v1/patients", tags=["Pacientes"])


@router.get("", response_model=list[PatientOut], response_model_by_alias=True)
def list_patients(
    search: str | None = Query(default=None, max_length=120),
    access_status: str | None = Query(default=None, alias="status"),
    current: CurrentUser = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    role = current.user.role
    return [
        to_patient_out(patient, patient_service.can_view_clinical_record(role, patient))
        for patient in patient_service.list_patients(db, search, access_status)
    ]


@router.get("/{patient_id}", response_model=PatientOut, response_model_by_alias=True)
def get_patient(
    patient_id: str,
    current: CurrentUser = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    patient, clinical_access = patient_service.view_patient(db, patient_id, current)
    return to_patient_out(patient, clinical_access)


@router.post(
    "",
    response_model=PatientOut,
    response_model_by_alias=True,
    status_code=status.HTTP_201_CREATED,
)
def create_patient(
    payload: PatientIn,
    current: CurrentUser = Depends(require_roles(*PATIENT_EDITOR_ROLES)),
    db: Session = Depends(get_db),
):
    patient = patient_service.create_patient(db, payload, current)
    return to_patient_out(
        patient, patient_service.can_view_clinical_record(current.user.role, patient)
    )


@router.patch("/{patient_id}", response_model=PatientOut, response_model_by_alias=True)
def update_patient(
    patient_id: str,
    payload: PatientUpdate,
    current: CurrentUser = Depends(require_roles(*PATIENT_EDITOR_ROLES)),
    db: Session = Depends(get_db),
):
    patient = patient_service.update_patient(db, patient_id, payload, current)
    return to_patient_out(
        patient, patient_service.can_view_clinical_record(current.user.role, patient)
    )


@router.delete("/{patient_id}", response_model=MessageResponse)
def delete_patient(
    patient_id: str,
    current: CurrentUser = Depends(require_roles("Administrador")),
    db: Session = Depends(get_db),
):
    patient_service.delete_patient(db, patient_id, current)
    return MessageResponse(message="Ficha de paciente eliminada")
