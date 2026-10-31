import uuid

from fastapi import APIRouter, Depends, Query, status

from app.core.database import DbSession
from app.modules.auth.dependencies import CurrentUser, require_permission
from app.modules.evaluations import service as evaluation_service
from app.modules.evaluations.schemas import (
    EvaluationArea,
    EvaluationIn,
    EvaluationOut,
    EvaluationUpdate,
    to_evaluation_out,
)
from app.modules.users.models import PATIENTS_READ_CLINICAL, PATIENTS_WRITE_CLINICAL

router = APIRouter(prefix="/api/v1/patients/{patient_id}/evaluations", tags=["Afiliados"])

readers = require_permission(PATIENTS_READ_CLINICAL)
writers = require_permission(PATIENTS_WRITE_CLINICAL)


@router.get("", response_model=list[EvaluationOut], response_model_by_alias=True)
def list_evaluations(
    patient_id: uuid.UUID,
    db: DbSession,
    area: EvaluationArea | None = Query(default=None),
    current: CurrentUser = Depends(readers),
):
    """Evaluaciones de seguimiento, la más reciente primero (queda en la bitácora)."""
    evaluations = evaluation_service.list_evaluations(db, patient_id, area, current)
    return [to_evaluation_out(evaluation) for evaluation in evaluations]


@router.get("/{evaluation_id}", response_model=EvaluationOut, response_model_by_alias=True)
def get_evaluation(
    patient_id: uuid.UUID,
    evaluation_id: uuid.UUID,
    db: DbSession,
    current: CurrentUser = Depends(readers),
):
    return to_evaluation_out(
        evaluation_service.get_evaluation(db, patient_id, evaluation_id, current)
    )


@router.post(
    "",
    response_model=EvaluationOut,
    response_model_by_alias=True,
    status_code=status.HTTP_201_CREATED,
)
def create_evaluation(
    patient_id: uuid.UUID,
    payload: EvaluationIn,
    db: DbSession,
    current: CurrentUser = Depends(writers),
):
    return to_evaluation_out(evaluation_service.create_evaluation(db, patient_id, payload, current))


@router.patch("/{evaluation_id}", response_model=EvaluationOut, response_model_by_alias=True)
def update_evaluation(
    patient_id: uuid.UUID,
    evaluation_id: uuid.UUID,
    payload: EvaluationUpdate,
    db: DbSession,
    current: CurrentUser = Depends(writers),
):
    """Corrige una evaluación. No hay DELETE: la historia clínica no se borra."""
    return to_evaluation_out(
        evaluation_service.update_evaluation(db, patient_id, evaluation_id, payload, current)
    )
