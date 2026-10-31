import uuid

from fastapi import APIRouter, Depends, Query, Request, status

from app.adapters.turnstile import TurnstileVerifier, get_turnstile
from app.core import rate_limit
from app.core.database import DbSession
from app.core.network import client_ip
from app.core.pagination import Pagination
from app.core.schemas import MessageResponse
from app.modules.auth.dependencies import CurrentUser, require_permission
from app.modules.auth.service import require_human
from app.modules.inquiries import repository as inquiry_repository
from app.modules.inquiries import service as inquiry_service
from app.modules.inquiries.models import KIND_LABELS, STATUS_LABELS, Inquiry
from app.modules.inquiries.schemas import (
    InquiryConvert,
    InquiryDetailOut,
    InquiryKind,
    InquiryOut,
    InquiryPage,
    InquiryStatus,
    InquirySummary,
    InquiryUpdate,
    NoteIn,
    NoteOut,
    PatientDraftOut,
    PublicInquiryIn,
)
from app.modules.patients.schemas import PatientOut, to_patient_out
from app.modules.users.models import INQUIRIES_MANAGE, PATIENTS_WRITE

router = APIRouter(prefix="/api/v1/inquiries", tags=["Solicitudes"])
public_router = APIRouter(prefix="/api/v1/public/inquiries", tags=["Sitio público"])

managers = require_permission(INQUIRIES_MANAGE)
# Inscribir abre una ficha: hace falta además poder registrar afiliados
enrollers = require_permission(INQUIRIES_MANAGE, PATIENTS_WRITE)

THANKS = "Recibimos tu solicitud. El equipo te llamará pronto."


def _fields(inquiry: Inquiry, titles: dict, names: dict) -> dict:
    return {
        "id": inquiry.id,
        "kind": inquiry.kind,
        "kind_label": KIND_LABELS[inquiry.kind],
        "source": inquiry.source,
        "name": inquiry.name,
        "phone": inquiry.phone,
        "on_behalf_of": inquiry.on_behalf_of,
        "zone": inquiry.zone,
        "preferred_call_time": inquiry.preferred_call_time,
        "message": inquiry.message,
        "schedule_id": inquiry.schedule_id,
        "schedule_title": titles.get(inquiry.schedule_id),
        "status": inquiry.status,
        "status_label": STATUS_LABELS[inquiry.status],
        "assigned_to": inquiry.assigned_to,
        "assigned_to_name": names.get(inquiry.assigned_to),
        "patient_id": inquiry.patient_id,
        "contact_consent": inquiry.contact_consent,
        "created_at": inquiry.created_at,
        "updated_at": inquiry.updated_at,
    }


def _detail(db: DbSession, inquiry: Inquiry) -> InquiryDetailOut:
    db.refresh(inquiry)
    return InquiryDetailOut(
        **_fields(
            inquiry,
            inquiry_service.schedule_titles(db, [inquiry]),
            inquiry_service.assignee_names(db, [inquiry]),
        ),
        notes=[
            NoteOut(id=n.id, author_name=n.author_name, note=n.note, created_at=n.created_at)
            for n in inquiry_repository.notes(db, inquiry.id)
        ],
    )


@public_router.post("", response_model=MessageResponse, status_code=status.HTTP_202_ACCEPTED)
def create_public(
    payload: PublicInquiryIn,
    request: Request,
    db: DbSession,
    turnstile: TurnstileVerifier = Depends(get_turnstile),
):
    """Orientación, voluntariado, donación en especie, «Quiero participar» u otro motivo."""
    ip = client_ip(request)
    rate_limit.hit(rate_limit.by_ip("solicitud", ip), *rate_limit.PUBLIC_FORM_PER_IP)
    require_human(turnstile.verify(payload.turnstile_token, ip))
    inquiry_service.create_public(db, payload)
    return MessageResponse(message=THANKS)


@router.get("", response_model=InquiryPage, response_model_by_alias=True)
def list_inquiries(
    db: DbSession,
    page: Pagination,
    status_filter: InquiryStatus | None = Query(default=None, alias="status"),
    kind: InquiryKind | None = None,
    search: str | None = Query(default=None, max_length=120),
    current: CurrentUser = Depends(managers),
):
    """Bandeja, la más reciente primero; busca por nombre o teléfono."""
    result = inquiry_service.list_inquiries(
        db, page, status=status_filter, kind=kind, search=search
    )
    titles = inquiry_service.schedule_titles(db, result.items)
    names = inquiry_service.assignee_names(db, result.items)
    return InquiryPage.of(result, lambda i: InquiryOut(**_fields(i, titles, names)))


@router.get("/summary", response_model=InquirySummary, response_model_by_alias=True)
def summary(db: DbSession, current: CurrentUser = Depends(managers)):
    return InquirySummary(**inquiry_service.summary(db))


@router.get("/{inquiry_id}", response_model=InquiryDetailOut, response_model_by_alias=True)
def get_inquiry(inquiry_id: uuid.UUID, db: DbSession, current: CurrentUser = Depends(managers)):
    """Solicitud con su historial de notas."""
    return _detail(db, inquiry_service.get_inquiry(db, inquiry_id))


@router.patch("/{inquiry_id}", response_model=InquiryDetailOut, response_model_by_alias=True)
def update_inquiry(
    inquiry_id: uuid.UUID,
    payload: InquiryUpdate,
    db: DbSession,
    current: CurrentUser = Depends(managers),
):
    """Cambia el estado (Nueva → Por contactar → Contactada, o Cerrada) o la persona asignada."""
    changes = payload.model_dump(exclude_unset=True)
    return _detail(db, inquiry_service.update(db, inquiry_id, changes, current))


@router.post(
    "/{inquiry_id}/notes",
    response_model=InquiryDetailOut,
    response_model_by_alias=True,
    status_code=status.HTTP_201_CREATED,
)
def add_note(
    inquiry_id: uuid.UUID, payload: NoteIn, db: DbSession, current: CurrentUser = Depends(managers)
):
    """Nota de la llamada; con markContacted=true la marca como contactada."""
    inquiry = inquiry_service.add_note(
        db, inquiry_id, payload.note, payload.mark_contacted, current
    )
    return _detail(db, inquiry)


@router.get(
    "/{inquiry_id}/patient-draft", response_model=PatientDraftOut, response_model_by_alias=True
)
def patient_draft(inquiry_id: uuid.UUID, db: DbSession, current: CurrentUser = Depends(enrollers)):
    """Datos para precargar la ficha antes de inscribir."""
    return PatientDraftOut(
        **inquiry_service.patient_draft(inquiry_service.get_inquiry(db, inquiry_id))
    )


@router.post(
    "/{inquiry_id}/convert-to-patient",
    response_model=PatientOut,
    response_model_by_alias=True,
    status_code=status.HTTP_201_CREATED,
)
def convert_to_patient(
    inquiry_id: uuid.UUID,
    payload: InquiryConvert,
    db: DbSession,
    current: CurrentUser = Depends(enrollers),
):
    """«Inscribir como afiliado»: abre la ficha con nombre y teléfono ya cargados."""
    patient = inquiry_service.convert_to_patient(db, inquiry_id, payload, current)
    return to_patient_out(patient, False)
