"""API REST del sistema ASPAR (Soluna Solutions) sobre PostgreSQL (Supabase).

Arquitectura en capas (diagrama C3): routers -> services -> repositories -> PostgreSQL.
"""

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from sqlalchemy import text

from app.core.config import settings
from app.core.database import DbSession
from app.core.errors import register_error_handlers
from app.core.logging import RequestContextMiddleware, configure_logging
from app.routers import audit, auth, patient_documents, patients, users

configure_logging(settings.log_level)

app = FastAPI(
    title="ASPAR API - Soluna Solutions",
    description=(
        "API RESTful del Sistema Web y de Gestión de la Asociación de Parkinson "
        "Mario Lagrava (ASPAR)"
    ),
    version="1.0.0",
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
    expose_headers=["X-Request-ID"],
)
# Se agrega al final para envolver a todos: el request_id existe incluso en errores de CORS
app.add_middleware(RequestContextMiddleware)

register_error_handlers(app)
app.include_router(auth.router)
app.include_router(patients.router)
app.include_router(patient_documents.router)
app.include_router(users.router)
app.include_router(audit.router)


@app.get("/api/v1/health", tags=["Sistema"])
def health() -> dict:
    """Prueba de vida liviana: no consulta la base (la usan Docker y Cloud Run)."""
    return {"status": "ok", "service": "ASPAR API"}


@app.get("/api/v1/health/db", tags=["Sistema"])
def health_db(db: DbSession) -> dict:
    """Verifica la conexión con PostgreSQL; si falla responde 503."""
    db.execute(text("select 1"))
    return {"status": "ok", "service": "ASPAR API", "database": "postgresql"}
