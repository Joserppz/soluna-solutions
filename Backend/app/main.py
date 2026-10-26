"""API REST del sistema ASPAR (Soluna Solutions) sobre Supabase PostgreSQL.

Arquitectura en capas (diagrama C3): routers -> services -> repositories -> PostgreSQL.
"""

from fastapi import Depends, FastAPI, HTTPException, status
from fastapi.middleware.cors import CORSMiddleware
from sqlalchemy import text
from sqlalchemy.exc import SQLAlchemyError
from sqlalchemy.orm import Session

from app.core.config import CORS_ORIGINS
from app.core.database import get_db
from app.core.errors import register_error_handlers
from app.routers import auth, patient_documents, patients, users

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
    allow_origins=CORS_ORIGINS,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

register_error_handlers(app)
app.include_router(auth.router)
app.include_router(patients.router)
app.include_router(patient_documents.router)
app.include_router(users.router)


@app.get("/api/v1/health", tags=["Sistema"])
def health(db: Session = Depends(get_db)) -> dict:
    try:
        db.execute(text("select 1"))
    except SQLAlchemyError as exc:
        raise HTTPException(
            status.HTTP_503_SERVICE_UNAVAILABLE, "Base de datos no disponible"
        ) from exc
    return {"status": "ok", "service": "ASPAR API", "database": "postgresql"}
