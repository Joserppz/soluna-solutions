"""Reglas del inventario (RF-03, RF-13): el stock nunca es negativo y todo cambio deja un
movimiento. Sin base de datos."""

from unittest.mock import patch

import pytest

from app.core.errors import Conflict, ValidationError
from app.modules.inventory import service
from app.modules.inventory.models import InventoryItem, InventoryMovement
from app.modules.inventory.schemas import MovementIn
from tests.unit.dobles import AHORA, sesion, usuario

SERVICIO = "app.modules.inventory.service"


def material(cantidad: int = 10, **cambios) -> InventoryItem:
    return InventoryItem(**({"name": "Colchonetas", "quantity": cantidad} | cambios))


@pytest.fixture
def dependencias():
    with (
        patch(f"{SERVICIO}.get_item") as obtener,
        patch(f"{SERVICIO}.audit_service") as registro,
        patch("app.core.clock.now", return_value=AHORA),
    ):
        yield obtener, registro


def movimiento(tipo: str, cantidad: int, motivo: str = "", destino: str = "") -> MovementIn:
    return MovementIn(movement_type=tipo, quantity=cantidad, reason=motivo, counterpart=destino)


class TestMovimientos:
    @pytest.mark.parametrize(
        ("tipo", "cantidad", "queda"),
        [("ingreso", 5, 15), ("prestamo", 4, 6), ("devolucion", 2, 12), ("ajuste", -3, 7)],
    )
    def test_cada_movimiento_suma_o_resta_y_queda_registrado(
        self, dependencias, tipo, cantidad, queda
    ):
        obtener, registro = dependencias
        item = material(10)
        obtener.return_value = item
        db = sesion()

        datos = movimiento(tipo, cantidad, motivo="Conteo de fin de mes", destino="Familia Rojas")

        service.add_movement(db, "i-1", datos, usuario())

        assert item.quantity == queda
        guardado = db.add.call_args.args[0]
        assert isinstance(guardado, InventoryMovement)
        assert guardado.movement_type == tipo
        assert guardado.quantity_delta == queda - 10
        registro.audit.assert_called_once()

    def test_no_se_presta_mas_de_lo_que_hay(self, dependencias):
        obtener, registro = dependencias
        item = material(3)
        obtener.return_value = item
        db = sesion()

        with pytest.raises(Conflict, match="Solo hay 3 unidades"):
            service.add_movement(db, "i-1", movimiento("prestamo", 4, destino="Ana"), usuario())

        assert item.quantity == 3
        db.add.assert_not_called()
        registro.audit.assert_not_called()

    def test_un_prestamo_dice_a_quien(self, dependencias):
        obtener, _ = dependencias
        obtener.return_value = material(10)

        with pytest.raises(ValidationError, match="a quién se presta"):
            service.add_movement(sesion(), "i-1", movimiento("prestamo", 1), usuario())

    def test_un_ajuste_exige_motivo_y_la_cantidad_no_es_cero(self, dependencias):
        obtener, _ = dependencias
        obtener.return_value = material(10)

        with pytest.raises(ValidationError, match="motivo del ajuste"):
            service.add_movement(sesion(), "i-1", movimiento("ajuste", -2), usuario())
        with pytest.raises(ValidationError, match="no puede ser cero"):
            service.add_movement(sesion(), "i-1", movimiento("ingreso", 0), usuario())

    def test_un_material_dado_de_baja_no_se_mueve(self, dependencias):
        obtener, _ = dependencias
        obtener.return_value = material(5, deleted_at=AHORA)

        with pytest.raises(Conflict, match="dado de baja"):
            service.add_movement(sesion(), "i-1", movimiento("ingreso", 1), usuario())
