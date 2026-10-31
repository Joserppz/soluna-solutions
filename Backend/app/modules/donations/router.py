import datetime as dt
import uuid

from fastapi import APIRouter, Depends, Query, Request, status

from app.adapters.turnstile import TurnstileVerifier, get_turnstile
from app.core import rate_limit
from app.core.database import DbSession
from app.core.errors import NotFound
from app.core.network import client_ip
from app.core.pagination import Pagination
from app.modules.auth.dependencies import CurrentUser, require_permission
from app.modules.auth.service import require_human
from app.modules.donations import repository as donation_repository
from app.modules.donations import service as donation_service
from app.modules.donations.models import STATUS_LABELS
from app.modules.donations.schemas import (
    DonationCancel,
    DonationChannel,
    DonationConfirm,
    DonationManualIn,
    DonationNoticeIn,
    DonationOut,
    DonationPage,
    DonationStatus,
    DonationSummary,
    DonationTrackingOut,
    GoalIn,
    GoalOut,
    PublicGoalOut,
    to_donation_out,
)
from app.modules.users.models import DONATIONS_MANAGE

router = APIRouter(prefix="/api/v1/donations", tags=["Donaciones"])
public_router = APIRouter(prefix="/api/v1/public/donations", tags=["Sitio público"])

managers = require_permission(DONATIONS_MANAGE)


def _tracking(donation) -> DonationTrackingOut:
    return DonationTrackingOut(
        id=donation.id,
        status=donation.status,
        status_label=STATUS_LABELS[donation.status],
        amount_bs=float(donation.amount_bs),
        created_at=donation.created_at,
    )


@public_router.post(
    "/notice",
    response_model=DonationTrackingOut,
    response_model_by_alias=True,
    status_code=status.HTTP_201_CREATED,
)
def register_notice(
    payload: DonationNoticeIn,
    request: Request,
    db: DbSession,
    turnstile: TurnstileVerifier = Depends(get_turnstile),
):
    """«Ya hice mi aporte»: aviso de un aporte por QR bancario (queda pendiente)."""
    ip = client_ip(request)
    rate_limit.hit(rate_limit.by_ip("aviso_aporte", ip), *rate_limit.PUBLIC_FORM_PER_IP)
    require_human(turnstile.verify(payload.turnstile_token, ip))
    return _tracking(donation_service.register_notice(db, payload))


@public_router.get(
    "/notice/{donation_id}", response_model=DonationTrackingOut, response_model_by_alias=True
)
def track_notice(donation_id: uuid.UUID, db: DbSession):
    """Estado de un aviso (Pendiente → Confirmado) con el id que recibió la persona."""
    donation = donation_repository.get(db, donation_id)
    if donation is None or donation.channel != "qr_bancario" or donation.source != "sitio":
        raise NotFound("No encontramos ese aviso.")
    return _tracking(donation)


@public_router.get("/goal", response_model=PublicGoalOut | None, response_model_by_alias=True)
def public_goal(db: DbSession):
    """Meta visible en el sitio e hitos; null si no hay meta visible."""
    goal = donation_repository.visible_goal(db)
    if goal is None:
        return None
    progress = donation_service.goal_progress(db, goal)
    progress.pop("confirmed_bs")
    return PublicGoalOut(**progress)


@router.get("", response_model=DonationPage, response_model_by_alias=True)
def list_donations(
    db: DbSession,
    page: Pagination,
    status_filter: DonationStatus | None = Query(default=None, alias="status"),
    channel: DonationChannel | None = None,
    search: str | None = Query(default=None, max_length=120),
    date_from: dt.date | None = Query(default=None, alias="from"),
    date_to: dt.date | None = Query(default=None, alias="to"),
    current: CurrentUser = Depends(managers),
):
    """Registro de aportes; busca por donante o comprobante."""
    result = donation_service.list_donations(
        db,
        page,
        status=status_filter,
        channel=channel,
        search=search,
        date_from=date_from,
        date_to=date_to,
    )
    return DonationPage.of(result, to_donation_out)


@router.get("/summary", response_model=DonationSummary, response_model_by_alias=True)
def summary(
    db: DbSession,
    month: str | None = Query(default=None, pattern=r"^\d{4}-\d{2}$", examples=["2026-10"]),
    current: CurrentUser = Depends(managers),
):
    """Resumen del mes: confirmado por canal, avisos por confirmar, especie y anulados."""
    return DonationSummary(**donation_service.month_summary(db, month))


def _goal_out(db: DbSession, goal) -> GoalOut:
    return GoalOut(
        id=goal.id,
        manual_adjustment_bs=float(goal.manual_adjustment_bs),
        visible=goal.visible,
        **donation_service.goal_progress(db, goal),
    )


@router.get("/goal", response_model=GoalOut | None, response_model_by_alias=True)
def get_goal(db: DbSession, current: CurrentUser = Depends(managers)):
    goal = donation_repository.current_goal(db)
    return _goal_out(db, goal) if goal else None


@router.put("/goal", response_model=GoalOut, response_model_by_alias=True)
def save_goal(payload: GoalIn, db: DbSession, current: CurrentUser = Depends(managers)):
    """«Editar meta»: título, monto, ajuste manual, hitos y si se ve en el sitio."""
    return _goal_out(db, donation_service.save_goal(db, payload, current))


@router.get("/{donation_id}", response_model=DonationOut, response_model_by_alias=True)
def get_donation(donation_id: uuid.UUID, db: DbSession, current: CurrentUser = Depends(managers)):
    return to_donation_out(donation_service.get_donation(db, donation_id))


@router.post(
    "",
    response_model=DonationOut,
    response_model_by_alias=True,
    status_code=status.HTTP_201_CREATED,
)
def register_manual(
    payload: DonationManualIn, db: DbSession, current: CurrentUser = Depends(managers)
):
    """«Registrar aporte recibido»: efectivo (confirmado) o en especie (recibido + inventario)."""
    return to_donation_out(donation_service.register_manual(db, payload, current))


@router.post("/{donation_id}/confirm", response_model=DonationOut, response_model_by_alias=True)
def confirm(
    donation_id: uuid.UUID,
    payload: DonationConfirm,
    db: DbSession,
    current: CurrentUser = Depends(managers),
):
    """Pendiente → confirmado con la referencia del extracto: suma a la meta."""
    donation = donation_service.confirm(
        db, donation_id, payload.bank_reference, payload.credited_on, current
    )
    return to_donation_out(donation)


@router.post("/{donation_id}/cancel", response_model=DonationOut, response_model_by_alias=True)
def cancel(
    donation_id: uuid.UUID,
    payload: DonationCancel,
    db: DbSession,
    current: CurrentUser = Depends(managers),
):
    """Pendiente → anulado con motivo (queda en el historial y en la bitácora)."""
    return to_donation_out(donation_service.cancel(db, donation_id, payload.reason, current))
