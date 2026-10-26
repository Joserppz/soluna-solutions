"""Respuestas de error uniformes: {"detail": "<mensaje en español>"}.

El frontend (services/api.ts) muestra body.detail como texto, por eso los errores de
validación de FastAPI (que por defecto son una lista) se convierten en un mensaje.
"""

from fastapi import FastAPI, Request, status
from fastapi.exceptions import RequestValidationError
from fastapi.responses import JSONResponse

FIELD_NAMES = {
    "email": "correo electrónico",
    "password": "contraseña",
}


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


def register_error_handlers(app: FastAPI) -> None:
    @app.exception_handler(RequestValidationError)
    async def handle_validation_error(_: Request, exc: RequestValidationError) -> JSONResponse:
        return JSONResponse(
            status_code=status.HTTP_422_UNPROCESSABLE_CONTENT,
            content={"detail": validation_message(exc)},
        )
