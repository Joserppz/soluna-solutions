"""Reglas de confirmación y anulación de aportes (RF-06, RF-14, RF-15), sin base de datos."""

import datetime as dt
from decimal import Decimal
from unittest.mock import MagicMock, patch

import pytest
from sqlalchemy.exc import IntegrityError

from app.core.errors import Conflict, ValidationError
from app.modules.donations import service
from app.modules.donations.models import Donation
from tests.unit.dobles import AHORA, HOY, sesion, usuario

SERVICIO = "app.modules.donations.service"


def aviso(**cambios) -> Donation:
    datos = {
        "channel": "qr_bancario",
        "status": "pendiente",
        "amount_bs": Decimal("100"),
        "goal_id": None,
        "date": HOY,
    }
    return Donation(**(datos | cambios))


@pytest.fixture
def dependencias():
    """Repositorio, registro de actividad y reloj reemplazados por dobles."""
    with (
        patch(f"{SERVICIO}.get_donation") as obtener,
        patch(f"{SERVICIO}.donation_repository") as repositorio,
        patch(f"{SERVICIO}.audit_service") as registro,
        patch("app.core.clock.today", return_value=HOY),
        patch("app.core.clock.now", return_value=AHORA),
    ):
        repositorio.bank_reference_used.return_value = False
        repositorio.visible_goal.return_value = MagicMock(id="meta-1")
        yield obtener, repositorio, registro


class TestConfirmar:
    def test_confirma_el_qr_pendiente_y_lo_suma_a_la_meta_visible(self, dependencias):
        obtener, repositorio, registro = dependencias
        donacion = aviso()
        obtener.return_value = donacion
        db, actual = sesion(), usuario("donations:manage")

        resultado = service.confirm(db, "d-1", "  EXT-0193  ", HOY, actual)

        assert resultado is donacion
        assert donacion.status == "confirmado"
        assert donacion.bank_reference == "EXT-0193"  # sin espacios
        assert donacion.credited_on == HOY
        assert donacion.reviewed_by == actual.user.id and donacion.reviewed_at == AHORA
        assert donacion.goal_id == "meta-1"
        obtener.assert_called_once_with(db, "d-1", lock=True)  # bloquea la fila
        repositorio.bank_reference_used.assert_called_once_with(db, "EXT-0193", donacion.id)
        registro.audit.assert_called_once()
        assert registro.audit.call_args.kwargs["action"] == "Confirmación de aporte"
        assert "EXT-0193" in registro.audit.call_args.kwargs["detail"]

    @pytest.mark.parametrize(
        "cambios",
        [{"channel": "efectivo"}, {"status": "confirmado"}, {"status": "anulado"}],
    )
    def test_solo_se_confirma_un_qr_pendiente(self, dependencias, cambios):
        obtener, repositorio, registro = dependencias
        obtener.return_value = aviso(**cambios)

        with pytest.raises(Conflict, match="QR bancario pendiente"):
            service.confirm(sesion(), "d-1", "EXT-1", HOY, usuario())

        repositorio.bank_reference_used.assert_not_called()
        registro.audit.assert_not_called()

    def test_la_fecha_de_acreditacion_no_puede_ser_futura(self, dependencias):
        obtener, _, registro = dependencias
        donacion = aviso()
        obtener.return_value = donacion

        with pytest.raises(ValidationError, match="no puede ser futura"):
            service.confirm(sesion(), "d-1", "EXT-1", HOY + dt.timedelta(days=1), usuario())

        assert donacion.status == "pendiente"
        registro.audit.assert_not_called()

    def test_una_referencia_ya_usada_no_confirma_otro_aporte(self, dependencias):
        obtener, repositorio, registro = dependencias
        donacion = aviso()
        obtener.return_value = donacion
        repositorio.bank_reference_used.return_value = True

        with pytest.raises(Conflict, match="ya confirmó otro aporte"):
            service.confirm(sesion(), "d-1", "EXT-1", HOY, usuario())

        assert donacion.status == "pendiente"
        registro.audit.assert_not_called()

    def test_dos_confirmaciones_simultaneas_no_suman_dos_veces(self, dependencias):
        """La base rechaza la segunda (índice único, migración 003) y el servicio lo explica."""
        obtener, _, registro = dependencias
        obtener.return_value = aviso()
        db = sesion()
        db.flush.side_effect = IntegrityError("UPDATE", {}, Exception("duplicada"))

        with pytest.raises(Conflict, match="ya confirmó otro aporte"):
            service.confirm(db, "d-1", "EXT-1", HOY, usuario())

        registro.audit.assert_not_called()

    def test_si_ya_tenia_meta_no_la_cambia(self, dependencias):
        obtener, repositorio, _ = dependencias
        donacion = aviso(goal_id="meta-anterior")
        obtener.return_value = donacion

        service.confirm(sesion(), "d-1", "EXT-1", HOY, usuario())

        assert donacion.goal_id == "meta-anterior"
        repositorio.visible_goal.assert_not_called()


class TestAnular:
    def test_anula_un_aviso_pendiente_con_motivo(self, dependencias):
        obtener, _, registro = dependencias
        donacion = aviso()
        obtener.return_value = donacion
        actual = usuario()

        service.cancel(sesion(), "d-1", "  No estaba en el extracto ", actual)

        assert donacion.status == "anulado"
        assert donacion.cancellation_reason == "No estaba en el extracto"
        assert donacion.reviewed_by == actual.user.id
        registro.audit.assert_called_once()
        # Anular queda como advertencia en el registro, con el motivo
        assert registro.audit.call_args.kwargs["severity"] == "WARNING"
        assert "No estaba en el extracto" in registro.audit.call_args.kwargs["detail"]

    def test_un_aporte_confirmado_no_se_anula(self, dependencias):
        obtener, _, registro = dependencias
        obtener.return_value = aviso(status="confirmado")

        with pytest.raises(Conflict, match="no se anula"):
            service.cancel(sesion(), "d-1", "Error", usuario())

        registro.audit.assert_not_called()
