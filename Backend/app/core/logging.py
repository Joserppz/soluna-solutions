"""Logs en JSON (una línea por evento) con el request_id de cada petición.

Cloud Run reconoce los campos ``severity`` y ``message``. Nunca se registran cuerpos de
petición, parámetros de búsqueda ni datos clínicos: solo método, ruta, estado y duración.
"""

import json
import logging
import re
import sys
import time
import uuid
from contextvars import ContextVar
from datetime import UTC, datetime

from starlette.responses import JSONResponse
from starlette.types import ASGIApp, Message, Receive, Scope, Send

_request_id: ContextVar[str | None] = ContextVar("request_id", default=None)
# Diccionario mutable por petición: las dependencias síncronas corren en otro hilo con una
# copia del contexto, así que no pueden reasignar una ContextVar, pero sí modificar esto.
_request_state: ContextVar[dict | None] = ContextVar("request_state", default=None)

REQUEST_ID_HEADER = "X-Request-ID"
_VALID_REQUEST_ID = re.compile(r"^[A-Za-z0-9_-]{8,64}$")
_STANDARD_ATTRS = set(logging.LogRecord("", 0, "", 0, "", None, None).__dict__) | {"message"}

INTERNAL_ERROR = (
    "Ocurrió un error inesperado. Si se repite, comunícalo a Administración con el código {code}."
)

access_logger = logging.getLogger("aspar.access")
error_logger = logging.getLogger("aspar.errors")


def current_request_id() -> str | None:
    return _request_id.get()


def set_current_user_id(user_id: str | None) -> None:
    """Lo llama la autenticación para que el log de acceso indique quién hizo la petición."""
    state = _request_state.get()
    if state is not None:
        state["user_id"] = user_id


class JsonFormatter(logging.Formatter):
    def format(self, record: logging.LogRecord) -> str:
        entry = {
            "timestamp": datetime.fromtimestamp(record.created, UTC).isoformat(),
            "severity": record.levelname,
            "logger": record.name,
            "message": record.getMessage(),
            "request_id": _request_id.get(),
        }
        # Campos adicionales pasados con logger.info(..., extra={...})
        entry |= {k: v for k, v in record.__dict__.items() if k not in _STANDARD_ATTRS}
        if record.exc_info:
            entry["exception"] = self.formatException(record.exc_info)
        return json.dumps(entry, ensure_ascii=False, default=str)


def configure_logging(level: str = "INFO") -> None:
    handler = logging.StreamHandler(sys.stdout)
    handler.setFormatter(JsonFormatter())
    root = logging.getLogger()
    root.handlers = [handler]
    root.setLevel(level)
    # Uvicorn trae sus propios handlers de texto: se unifican en el JSON de la raíz
    for name in ("uvicorn", "uvicorn.error"):
        uvicorn_logger = logging.getLogger(name)
        uvicorn_logger.handlers = []
        uvicorn_logger.propagate = True
    # El log de acceso lo escribe RequestContextMiddleware (con request_id y duración)
    access = logging.getLogger("uvicorn.access")
    access.handlers = []
    access.propagate = False


class RequestContextMiddleware:
    """Asigna un request_id a cada petición, lo devuelve en X-Request-ID y deja un log.

    También responde los errores no controlados con un 500 en JSON (sin detalles internos)
    que incluye el código de la petición para encontrarla en los logs.
    """

    def __init__(self, app: ASGIApp) -> None:
        self.app = app

    async def __call__(self, scope: Scope, receive: Receive, send: Send) -> None:
        if scope["type"] != "http":
            await self.app(scope, receive, send)
            return

        incoming = dict(scope["headers"]).get(REQUEST_ID_HEADER.lower().encode(), b"").decode()
        request_id = incoming if _VALID_REQUEST_ID.match(incoming) else uuid.uuid4().hex
        request_token = _request_id.set(request_id)
        state: dict = {}
        state_token = _request_state.set(state)
        started = time.perf_counter()
        status_code = 500
        response_started = False

        async def send_with_request_id(message: Message) -> None:
            nonlocal status_code, response_started
            if message["type"] == "http.response.start":
                response_started = True
                status_code = message["status"]
                headers = list(message.get("headers", []))
                headers.append((REQUEST_ID_HEADER.encode(), request_id.encode()))
                message["headers"] = headers
            await send(message)

        try:
            await self.app(scope, receive, send_with_request_id)
        except Exception:
            error_logger.exception("Error no controlado")
            if response_started:
                raise
            response = JSONResponse(
                {"detail": INTERNAL_ERROR.format(code=request_id)}, status_code=500
            )
            await response(scope, receive, send_with_request_id)
        finally:
            access_logger.info(
                "%s %s %s",
                scope["method"],
                scope["path"],
                status_code,
                extra={
                    "http_method": scope["method"],
                    "path": scope["path"],
                    "status": status_code,
                    "duration_ms": round((time.perf_counter() - started) * 1000, 1),
                    "user_id": state.get("user_id"),
                },
            )
            _request_state.reset(state_token)
            _request_id.reset(request_token)
