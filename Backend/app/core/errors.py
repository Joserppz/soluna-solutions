"""Errores de dominio y respuestas de error uniformes: {"detail": "<mensaje en español>"}.

Los errores no controlados (500) los responde RequestContextMiddleware en
app/core/logging.py, con el código de la petición.

Los servicios lanzan excepciones de dominio (NotFound, Conflict, Forbidden...) sin saber
nada de HTTP; aquí se traducen al código de estado. El frontend (services/api.ts) muestra
``body.detail`` como texto, por eso también los errores de validación de FastAPI (que por
defecto son una lista) se convierten en un mensaje.
"""

import logging

from fastapi import FastAPI, Request, status
from fastapi.exceptions import RequestValidationError
from fastapi.responses import JSONResponse
from sqlalchemy.exc import IntegrityError, OperationalError

logger = logging.getLogger("aspar.errors")


class DomainError(Exception):
    """Error de negocio con un mensaje apto para mostrar al usuario.

    ``persist=True`` confirma en la base lo hecho antes del error, por ejemplo el registro
    en la bitácora de un intento rechazado; por defecto la unidad de trabajo se revierte.
    """

    status_code = status.HTTP_400_BAD_REQUEST

    def __init__(self, message: str, *, persist: bool = False) -> None:
        super().__init__(message)
        self.message = message
        self.persist = persist


class ValidationError(DomainError):
    status_code = status.HTTP_422_UNPROCESSABLE_CONTENT


class Unauthorized(DomainError):
    status_code = status.HTTP_401_UNAUTHORIZED


class Forbidden(DomainError):
    status_code = status.HTTP_403_FORBIDDEN


class NotFound(DomainError):
    status_code = status.HTTP_404_NOT_FOUND


class Conflict(DomainError):
    status_code = status.HTTP_409_CONFLICT


class PayloadTooLarge(DomainError):
    status_code = status.HTTP_413_CONTENT_TOO_LARGE


class UnsupportedMediaType(DomainError):
    status_code = status.HTTP_415_UNSUPPORTED_MEDIA_TYPE


class Locked(DomainError):
    status_code = status.HTTP_423_LOCKED


class ExternalServiceError(DomainError):
    """Falla de un servicio externo (por ejemplo, Supabase Storage)."""

    status_code = status.HTTP_502_BAD_GATEWAY


class ServiceUnavailable(DomainError):
    status_code = status.HTTP_503_SERVICE_UNAVAILABLE


FIELD_NAMES = {
    "email": "correo electrónico",
    "password": "contraseña",
}

CONFLICT_MESSAGE = "El dato ya existe o entra en conflicto con otro registro."
DATABASE_UNAVAILABLE = "La base de datos no está disponible en este momento. Intenta nuevamente."


def _field(loc: tuple) -> str:
    name = str(loc[-1]) if loc else "dato"
    return FIELD_NAMES.get(name, name)


def validation_message(exc: RequestValidationError) -> str:
    messages = []
    for error in exc.errors():
        field = _field(tuple(error.get("loc", ())))
        if error.get("type") == "missing":
            messages.append(f"El campo {field} es obligatorio.")
        else:
            reason = str(error.get("msg", "valor inválido")).removeprefix("Value error, ")
            messages.append(f"{field}: {reason}")
    return " ".join(messages) or "Datos de entrada inválidos."


def _error(status_code: int, detail: str) -> JSONResponse:
    # El request_id va en el encabezado X-Request-ID de todas las respuestas
    return JSONResponse(status_code=status_code, content={"detail": detail})


def register_error_handlers(app: FastAPI) -> None:
    @app.exception_handler(DomainError)
    async def handle_domain_error(_: Request, exc: DomainError) -> JSONResponse:
        return _error(exc.status_code, exc.message)

    @app.exception_handler(RequestValidationError)
    async def handle_validation_error(_: Request, exc: RequestValidationError) -> JSONResponse:
        return _error(status.HTTP_422_UNPROCESSABLE_CONTENT, validation_message(exc))

    @app.exception_handler(IntegrityError)
    async def handle_integrity_error(_: Request, exc: IntegrityError) -> JSONResponse:
        # Dos peticiones simultáneas pueden pasar la verificación previa (correo o CI
        # repetidos): la restricción UNIQUE de PostgreSQL es la que decide.
        logger.warning("Conflicto de integridad en la base: %s", type(exc.orig).__name__)
        return _error(status.HTTP_409_CONFLICT, CONFLICT_MESSAGE)

    @app.exception_handler(OperationalError)
    async def handle_operational_error(_: Request, exc: OperationalError) -> JSONResponse:
        logger.error("Base de datos no disponible: %s", type(exc.orig).__name__)
        return _error(status.HTTP_503_SERVICE_UNAVAILABLE, DATABASE_UNAVAILABLE)
