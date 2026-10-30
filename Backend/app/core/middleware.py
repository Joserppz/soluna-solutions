"""Middlewares de seguridad de la API."""

from starlette.responses import JSONResponse
from starlette.types import ASGIApp, Receive, Scope, Send

from app.core.config import settings

UNSAFE_METHODS = {"POST", "PUT", "PATCH", "DELETE"}


class OriginCheckMiddleware:
    """Rechaza peticiones que modifican datos desde un sitio que no es el frontend.

    Los navegadores siempre envían el encabezado Origin en peticiones POST/PUT/PATCH/
    DELETE entre sitios: si no está en CORS_ORIGINS, la petición se rechaza antes de
    llegar a la API. Es una segunda barrera además del token CSRF.
    """

    def __init__(self, app: ASGIApp) -> None:
        self.app = app

    async def __call__(self, scope: Scope, receive: Receive, send: Send) -> None:
        if scope["type"] == "http" and scope["method"] in UNSAFE_METHODS:
            origin = dict(scope["headers"]).get(b"origin", b"").decode()
            if origin and origin not in settings.cors_origins:
                response = JSONResponse({"detail": "Origen no permitido."}, status_code=403)
                await response(scope, receive, send)
                return
        await self.app(scope, receive, send)
