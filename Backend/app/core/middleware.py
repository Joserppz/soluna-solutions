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


DOCS_PATHS = ("/docs", "/redoc", "/openapi.json")


class SecurityHeadersMiddleware:
    """Cabeceras de seguridad en todas las respuestas de la API.

    - La API solo devuelve JSON: CSP sin permisos y sin poder mostrarse en un iframe.
    - Las respuestas con datos personales no se guardan en cachés (Cache-Control).
    - HSTS solo en producción (HTTPS obligatorio para el dominio y sus subdominios).
    """

    def __init__(self, app: ASGIApp, *, hsts: bool) -> None:
        self.app = app
        self.hsts = hsts

    async def __call__(self, scope: Scope, receive: Receive, send: Send) -> None:
        if scope["type"] != "http":
            await self.app(scope, receive, send)
            return
        is_docs = scope["path"].startswith(DOCS_PATHS)

        async def send_with_headers(message) -> None:
            if message["type"] == "http.response.start":
                headers = list(message.get("headers", []))
                extra = {
                    b"x-content-type-options": b"nosniff",
                    b"x-frame-options": b"DENY",
                    b"referrer-policy": b"no-referrer",
                    b"permissions-policy": b"camera=(), microphone=(), geolocation=()",
                    b"cross-origin-opener-policy": b"same-origin",
                }
                if not is_docs:
                    # /docs (solo en desarrollo) necesita cargar el Swagger UI
                    extra[b"content-security-policy"] = (
                        b"default-src 'none'; frame-ancestors 'none'"
                    )
                    extra[b"cache-control"] = b"no-store"
                if self.hsts:
                    extra[b"strict-transport-security"] = b"max-age=31536000; includeSubDomains"
                present = {name.lower() for name, _ in headers}
                headers += [(name, value) for name, value in extra.items() if name not in present]
                message["headers"] = headers
            await send(message)

        await self.app(scope, receive, send_with_headers)
