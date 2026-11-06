"""Donaciones (RF-06, RF-14, RF-15; diseño págs. 4, 5, 15 y 16). Sin pasarela de pago.

- QR bancario: la persona dona desde su banco y avisa en el sitio (nace «pendiente»).
  El equipo lo confirma con la referencia del extracto o lo anula con un motivo.
- Efectivo en la sede: entra «confirmado». QR bancario en la sede (la persona transfiere
  ahí mismo): entra «pendiente» con su comprobante y se confirma con el extracto, igual
  que un aviso del sitio. En especie: entra «recibido» y, si se pide, crea el material en
  el inventario con origen «donado».
- La meta pública suma solo lo confirmado (más su ajuste manual). Nada se borra.
"""

import datetime as dt
import uuid
from decimal import Decimal

from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from app.core import clock
from app.core.errors import Conflict, NotFound, ValidationError
from app.core.pagination import PageParams, PageResult
from app.modules.audit import service as audit_service
from app.modules.auth.dependencies import CurrentUser
from app.modules.donations import repository as donation_repository
from app.modules.donations.models import (
    CHANNEL_LABELS,
    Donation,
    DonationGoal,
    DonationGoalMilestone,
)
from app.modules.donations.schemas import DonationManualIn, DonationNoticeIn, GoalIn
from app.modules.inventory.schemas import ItemIn
from app.modules.inventory.service import register_item

NOT_FOUND = "Aporte no encontrado."
REFERENCE_USED = "Esa referencia del extracto ya confirmó otro aporte: revisa que no sea el mismo."
ANONYMOUS = "Anónimo"


def _clean(value: str | None) -> str | None:
    value = (value or "").strip()
    return value or None


def _audit(
    db: Session,
    current: CurrentUser,
    donation: Donation,
    severity: str,
    action: str,
    extra: str = "",
) -> None:
    amount = f"Bs. {donation.amount_bs}" if donation.amount_bs is not None else "en especie"
    audit_service.audit(
        db,
        current,
        category="DONACIONES",
        severity=severity,
        action=action,
        detail=(
            f"{donation.donor_name or ANONYMOUS} · {CHANNEL_LABELS[donation.channel]} · {amount}"
            f" ({donation.id}){extra}"
        ),
    )


def get_donation(db: Session, donation_id: uuid.UUID, lock: bool = False) -> Donation:
    donation = donation_repository.get(db, donation_id, lock)
    if donation is None:
        raise NotFound(NOT_FOUND)
    return donation


def list_donations(db: Session, page: PageParams, **filters) -> PageResult:
    return donation_repository.list_donations(db, page, **filters)


# ---------------------------------------------------------------------------
# Sitio público
# ---------------------------------------------------------------------------
def register_notice(db: Session, data: DonationNoticeIn) -> Donation:
    goal = donation_repository.visible_goal(db)
    donation = Donation(
        donor_name=_clean(data.donor_name),
        donor_contact=_clean(data.donor_contact),
        channel="qr_bancario",
        source="sitio",
        amount_bs=data.amount_bs,
        purpose=_clean(data.purpose) or "Donde más se necesite",
        status="pendiente",
        declared_reference=_clean(data.declared_reference),
        goal_id=goal.id if goal else None,
        date=clock.today(),
    )
    if donation.donor_name is not None and len(donation.donor_name) < 2:
        raise ValidationError("Escribe tu nombre o deja el campo vacío para donar en anonimato.")
    db.add(donation)
    db.flush()
    db.refresh(donation)
    audit_service.record(
        db,
        actor=donation.donor_name or ANONYMOUS,
        actor_role="Sitio público",
        category="DONACIONES",
        severity="INFO",
        action="Aviso de aporte por QR bancario",
        detail=f"Aviso de Bs. {donation.amount_bs} ({donation.id}), pendiente de confirmar",
    )
    return donation


def goal_progress(db: Session, goal: DonationGoal) -> dict:
    confirmed, count = donation_repository.confirmed_for_goal(db, goal.id)
    raised = max(Decimal(0), confirmed + goal.manual_adjustment_bs)
    percent = int(min(100, raised * 100 / goal.target_bs)) if goal.target_bs else 0
    return {
        "title": goal.title,
        "description": goal.description,
        "target_bs": float(goal.target_bs),
        "raised_bs": float(raised),
        "percent": percent,
        "confirmed_count": count,
        "confirmed_bs": float(confirmed),
        "milestones": [{"label": m.label, "status": m.status} for m in goal.milestones],
    }


# ---------------------------------------------------------------------------
# Espacio del equipo
# ---------------------------------------------------------------------------
def confirm(
    db: Session,
    donation_id: uuid.UUID,
    bank_reference: str,
    credited_on: dt.date,
    current: CurrentUser,
) -> Donation:
    donation = get_donation(db, donation_id, lock=True)
    if donation.channel != "qr_bancario" or donation.status != "pendiente":
        raise Conflict("Solo se confirma un aviso de QR bancario pendiente.")
    reference = bank_reference.strip()
    if credited_on > clock.today():
        raise ValidationError("La fecha de acreditación no puede ser futura.")
    if donation_repository.bank_reference_used(db, reference, donation.id):
        raise Conflict(REFERENCE_USED)
    donation.status = "confirmado"
    donation.bank_reference = reference
    donation.credited_on = credited_on
    donation.reviewed_by = current.user.id
    donation.reviewed_at = clock.now()
    if donation.goal_id is None:
        goal = donation_repository.visible_goal(db)
        donation.goal_id = goal.id if goal else None
    try:
        # Si otra persona confirmó al mismo tiempo otro aviso con esta referencia, el índice
        # único de la migración 003 rechaza esta: 409, nunca dos sumas a la meta
        db.flush()
    except IntegrityError as exc:
        raise Conflict(REFERENCE_USED) from exc
    _audit(db, current, donation, "INFO", "Confirmación de aporte", f", extracto {reference}")
    db.flush()
    return donation


def cancel(db: Session, donation_id: uuid.UUID, reason: str, current: CurrentUser) -> Donation:
    donation = get_donation(db, donation_id, lock=True)
    if donation.status != "pendiente":
        raise Conflict("Solo se anula un aviso pendiente. Un aporte confirmado no se anula.")
    donation.status = "anulado"
    donation.cancellation_reason = reason.strip()
    donation.reviewed_by = current.user.id
    donation.reviewed_at = clock.now()
    _audit(
        db,
        current,
        donation,
        "WARNING",
        "Anulación de aviso de aporte",
        f". Motivo: {donation.cancellation_reason}",
    )
    db.flush()
    return donation


def register_manual(db: Session, data: DonationManualIn, current: CurrentUser) -> Donation:
    """Aporte recibido en la sede: efectivo (confirmado), QR (pendiente) o especie (recibido)."""
    received_on = data.date or clock.today()
    if received_on > clock.today():
        raise ValidationError("La fecha de recepción no puede ser futura.")
    donor_name = _clean(data.donor_name)
    donation = Donation(
        donor_name=donor_name,
        donor_contact=_clean(data.donor_contact),
        channel=data.channel,
        source="sede",
        purpose=_clean(data.purpose) or "Donde más se necesite",
        registered_by=current.user.id,
        reviewed_by=current.user.id,
        reviewed_at=clock.now(),
        date=received_on,
    )
    if data.channel in ("efectivo", "qr_bancario"):
        if data.amount_bs is None:
            raise ValidationError(
                "Indica el monto recibido en efectivo."
                if data.channel == "efectivo"
                else "Indica el monto de la transferencia."
            )
        goal = donation_repository.visible_goal(db)
        donation.amount_bs = data.amount_bs
        donation.declared_reference = _clean(data.receipt_number)
        donation.goal_id = goal.id if goal else None
        if data.channel == "efectivo":
            donation.status = "confirmado"
        else:
            # Se confirma con el extracto del banco, como cualquier aviso por QR
            donation.status = "pendiente"
            donation.reviewed_by = None
            donation.reviewed_at = None
    else:
        description = (data.in_kind_description or "").strip()
        if len(description) < 3:
            raise ValidationError("Describe qué se recibió.")
        donation.in_kind_description = description
        donation.estimated_value_bs = data.estimated_value_bs
        donation.status = "recibido"
        if data.add_to_inventory:
            item = register_item(
                db,
                ItemIn(
                    name=description[:120],
                    category=data.category,
                    quantity=data.quantity,
                    condition=data.condition,
                    origin="donado",
                    donor_or_institution=(donor_name or ANONYMOUS)[:120],
                    entry_date=received_on,
                ),
                current.user.id,
                reason="Donación en especie",
            )
            donation.inventory_item_id = item.id
    db.add(donation)
    db.flush()
    db.refresh(donation)
    _audit(db, current, donation, "INFO", "Registro de aporte recibido en la sede")
    return donation


def save_goal(db: Session, data: GoalIn, current: CurrentUser) -> DonationGoal:
    """Edita la meta vigente (o la crea). Solo una meta se muestra en el sitio."""
    goal = donation_repository.current_goal(db)
    if goal is None:
        goal = DonationGoal(starts_on=clock.today())
        db.add(goal)
    goal.title = data.title.strip()
    goal.description = data.description.strip()
    goal.target_bs = data.target_bs
    goal.manual_adjustment_bs = data.manual_adjustment_bs
    goal.visible = data.visible
    goal.milestones = [
        DonationGoalMilestone(label=m.label.strip(), status=m.status, position=index)
        for index, m in enumerate(data.milestones)
    ]
    db.flush()
    audit_service.audit(
        db,
        current,
        category="DONACIONES",
        severity="WARNING" if data.manual_adjustment_bs else "INFO",
        action="Edición de la meta pública",
        detail=(
            f"{goal.title}: meta Bs. {goal.target_bs}, ajuste Bs. {goal.manual_adjustment_bs}, "
            f"visible={goal.visible}"
        ),
    )
    db.refresh(goal)
    return goal


def month_report(db: Session, month: str | None) -> tuple[dict, list[Donation]]:
    """Resumen del mes y el detalle de sus aportes (para exportarlos)."""
    label, first, last = clock.month_range(month)
    rows = donation_repository.month_rows(db, first, last)
    confirmed = [d for d in rows if d.status == "confirmado"]
    by_channel = {}
    for donation in confirmed:
        by_channel[donation.channel] = by_channel.get(donation.channel, Decimal(0)) + (
            donation.amount_bs or Decimal(0)
        )
    summary = {
        "month": label,
        "confirmed_bs": float(sum(by_channel.values(), Decimal(0))),
        "confirmed_count": len(confirmed),
        "pending_count": sum(d.status == "pendiente" for d in rows),
        "in_kind_count": sum(d.status == "recibido" for d in rows),
        "cancelled_count": sum(d.status == "anulado" for d in rows),
        "by_channel": [
            {"channel": channel, "label": CHANNEL_LABELS[channel], "amount_bs": float(total)}
            for channel, total in sorted(by_channel.items(), key=lambda item: -item[1])
        ],
    }
    return summary, rows
