"""API REST del sistema ASPAR (Soluna Solutions) sobre PostgreSQL (Supabase).

Arquitectura modular: cada dominio vive en app/modules/<dominio>/ con su router (HTTP),
service (reglas de negocio), repository (consultas), schemas (DTOs) y models (tablas).
Lo compartido (configuración, base de datos, errores, logs, seguridad) está en app/core/.
"""

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from sqlalchemy import text

from app.core.config import settings
from app.core.database import DbSession
from app.core.errors import register_error_handlers
from app.core.logging import RequestContextMiddleware, configure_logging
from app.core.middleware import OriginCheckMiddleware, SecurityHeadersMiddleware
from app.modules.audit import router as audit
from app.modules.auth import router as auth
from app.modules.auth.cookies import CSRF_HEADER
from app.modules.documents import router as documents
from app.modules.evaluations import router as evaluations
from app.modules.patients import router as patients
from app.modules.roles import router as roles
from app.modules.users import router as users

configure_logging(settings.log_level)


def create_app() -> FastAPI:
    # En producción no se publica la documentación interactiva ni el esquema OpenAPI:
    # el contrato vive en docs/api/openapi.json del repositorio.
    docs = (
        {} if not settings.is_prod else {"docs_url": None, "redoc_url": None, "openapi_url": None}
    )
    application = FastAPI(
        title="ASPAR API - Soluna Solutions",
        description=(
            "API RESTful del Sistema Web y de Gestión de la Asociación de Parkinson "
            "Mario Lagrava (ASPAR)"
        ),
        version="1.0.0",
        **docs,
    )

    application.add_middleware(
        CORSMiddleware,
        allow_origins=settings.cors_origins,
        # El navegador envía las cookies de sesión a la API
        allow_credentials=True,
        allow_methods=["GET", "POST", "PUT", "PATCH", "DELETE"],
        allow_headers=["Content-Type", CSRF_HEADER, "X-Request-ID"],
        expose_headers=["X-Request-ID", "Retry-After"],
        max_age=600,
    )
    application.add_middleware(OriginCheckMiddleware)
    application.add_middleware(SecurityHeadersMiddleware, hsts=settings.is_prod)
    # Se agrega al final para envolver a todos: el request_id existe incluso en errores de CORS
    application.add_middleware(RequestContextMiddleware)

    register_error_handlers(application)
    application.include_router(auth.router)
    application.include_router(patients.router)
    application.include_router(documents.router)
    application.include_router(evaluations.router)
    application.include_router(users.router)
    application.include_router(roles.router)
    application.include_router(audit.router)

    @application.get("/api/v1/health", tags=["Sistema"])
    def health() -> dict:
        """Prueba de vida liviana: no consulta la base (la usan Docker y Cloud Run)."""
        return {"status": "ok", "service": "ASPAR API"}

    @application.get("/api/v1/health/db", tags=["Sistema"])
    def health_db(db: DbSession) -> dict:
        """Verifica la conexión con PostgreSQL; si falla responde 503."""
        db.execute(text("select 1"))
        return {"status": "ok", "service": "ASPAR API", "database": "postgresql"}

    return application


app = create_app()
