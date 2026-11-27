"""Reglas de la toma de asistencia (RF-12), sin base de datos."""

import datetime as dt
from unittest.mock import MagicMock, patch

import pytest

from app.core.errors import Conflict
from app.modules.attendance import service
from app.modules.attendance.models import Attendance
from app.modules.schedules.models import Schedule
from tests.unit.dobles import AHORA, HOY, sesion, usuario

SERVICIO = "app.modules.attendance.service"


def actividad(**cambios) -> Schedule:
    datos = {"status": "publicada", "date": HOY, "attendance_closed_at": None}
    return Schedule(**(datos | cambios))


@pytest.fixture(autouse=True)
def reloj():
    with (
        patch("app.core.clock.today", return_value=HOY),
        patch("app.core.clock.now", return_value=AHORA),
    ):
        yield


class TestCuandoSeTomaAsistencia:
    def test_una_actividad_publicada_de_hoy_esta_abierta(self):
        service._check_open(actividad())  # no lanza
        service._check_open(actividad(date=HOY - dt.timedelta(days=7)))  # días anteriores, abierta

    @pytest.mark.parametrize(
        ("cambios", "motivo"),
        [
            ({"status": "borrador"}, "borrador"),
            ({"status": "cancelada"}, "cancelada"),
            ({"date": HOY + dt.timedelta(days=1)}, "el día de la actividad"),
            ({"attendance_closed_at": AHORA}, "ya se cerró"),
        ],
    )
    def test_no_se_marca_fuera_de_su_dia_ni_cerrada(self, cambios, motivo):
        with pytest.raises(Conflict, match=motivo):
            service._check_open(actividad(**cambios))

    def test_reabrir_permite_una_actividad_cerrada(self):
        service._check_open(actividad(attendance_closed_at=AHORA), allow_closed=True)


class TestMarcar:
    @pytest.fixture
    def fila(self):
        marca = Attendance(status="sin_marcar", note="")
        with (
            patch(f"{SERVICIO}.get_schedule", return_value=actividad()),
            patch(f"{SERVICIO}._row", return_value=(MagicMock(name="Patient"), marca)),
        ):
            yield marca

    def test_marcar_guarda_quien_y_cuando(self, fila):
        actual = usuario("attendance:write", rol="Voluntariado")

        service.mark(sesion(), "s-1", "p-1", "vino", "  llegó tarde ", actual)

        assert fila.status == "vino"
        assert fila.note == "llegó tarde"
        assert fila.marked_by == actual.user.id and fila.marked_at == AHORA

    def test_volver_a_sin_marcar_borra_quien_y_cuando(self, fila):
        fila.marked_by, fila.marked_at = "alguien", AHORA

        service.mark(sesion(), "s-1", "p-1", "sin_marcar", None, usuario())

        assert fila.status == "sin_marcar"
        assert fila.marked_by is None and fila.marked_at is None

    def test_no_marca_en_una_actividad_cancelada(self):
        with (
            patch(f"{SERVICIO}.get_schedule", return_value=actividad(status="cancelada")),
            patch(f"{SERVICIO}._row") as fila,
            pytest.raises(Conflict),
        ):
            service.mark(sesion(), "s-1", "p-1", "vino", None, usuario())
        fila.assert_not_called()


def test_marcar_a_todos_solo_toca_a_quienes_siguen_sin_marcar():
    """«Marcar a todos como presentes» no pisa un «No vino» ya registrado."""
    con_marca = (MagicMock(id="p-1"), Attendance(status="no_vino"))
    sin_marca = (MagicMock(id="p-2"), None)
    with (
        patch(f"{SERVICIO}.get_schedule", return_value=actividad(id="s-1")),
        patch(f"{SERVICIO}.attendance_repository") as repositorio,
        patch(f"{SERVICIO}.audit_service") as registro,
    ):
        repositorio.roster.return_value = [con_marca, sin_marca]
        repositorio.mark_unmarked_as_present.return_value = 1
        actual = usuario()

        marcadas = service.mark_all_present(sesion(), "s-1", actual)

    assert marcadas == 1
    repositorio.ensure_rows.assert_called_once()
    assert repositorio.ensure_rows.call_args.args[2] == ["p-2"]
    registro.audit.assert_called_once()
