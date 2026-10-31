"""DTOs de las evaluaciones de seguimiento (camelCase)."""

import uuid
from datetime import date, datetime
from typing import Literal

from pydantic import Field

from app.core.schemas import CamelModel
from app.modules.evaluations.models import AREA_LABELS, AREAS, PatientEvaluation

EvaluationArea = Literal[AREAS]


class EvaluationIn(CamelModel):
    area: EvaluationArea
    evaluated_on: date
    # Una cuenta del personal clínico; si se omite, se usa professionalName o quien registra
    professional_id: uuid.UUID | None = None
    professional_name: str | None = Field(default=None, max_length=120)
    notes: str = Field(max_length=4000)


class EvaluationUpdate(CamelModel):
    area: EvaluationArea | None = None
    evaluated_on: date | None = None
    professional_id: uuid.UUID | None = None
    professional_name: str | None = Field(default=None, max_length=120)
    notes: str | None = Field(default=None, max_length=4000)


class EvaluationOut(CamelModel):
    id: uuid.UUID
    patient_id: uuid.UUID
    area: EvaluationArea
    area_label: str
    evaluated_on: date
    professional_id: uuid.UUID | None
    professional_name: str
    notes: str
    created_at: datetime
    updated_at: datetime


def to_evaluation_out(evaluation: PatientEvaluation) -> EvaluationOut:
    return EvaluationOut(
        id=evaluation.id,
        patient_id=evaluation.patient_id,
        area=evaluation.area,
        area_label=AREA_LABELS[evaluation.area],
        evaluated_on=evaluation.evaluated_on,
        professional_id=evaluation.professional_id,
        professional_name=evaluation.professional_name,
        notes=evaluation.notes,
        created_at=evaluation.created_at,
        updated_at=evaluation.updated_at,
    )
