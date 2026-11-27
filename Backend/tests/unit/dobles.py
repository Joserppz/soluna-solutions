"""Dobles de prueba para las pruebas unitarias de reglas de negocio.

Las pruebas unitarias no tocan la base: la sesión, los repositorios, el registro de
actividad y el reloj se reemplazan por dobles (``unittest.mock``), igual que xUnit con Moq
en .NET. Así cada prueba verifica una regla del servicio y lo que el servicio le pide a
sus dependencias, en milisegundos. Las pruebas de integración (``tests/test_*.py``)
recorren la API completa contra PostgreSQL.
"""

import datetime as dt
import uuid
from unittest.mock import MagicMock

HOY = dt.date(2026, 11, 26)
AHORA = dt.datetime(2026, 11, 26, 10, 30, tzinfo=dt.timezone(dt.timedelta(hours=-4)))


def usuario(*permisos: str, rol: str = "Coordinación") -> MagicMock:
    """CurrentUser con los permisos indicados."""
    actual = MagicMock(name="CurrentUser")
    actual.user.id = uuid.uuid4()
    actual.user.role_name = rol
    actual.can.side_effect = lambda permiso: permiso in permisos
    return actual


def sesion() -> MagicMock:
    """Session de SQLAlchemy: registra flush/add sin base de datos."""
    return MagicMock(name="Session")
