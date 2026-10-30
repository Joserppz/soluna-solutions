import uuid
from datetime import datetime

from sqlalchemy import DateTime, Integer, String, Text, Uuid, func
from sqlalchemy.orm import Mapped, mapped_column

from app.core.database import Base

AUDIT_CATEGORIES = (
    "AUTENTICACION",
    "PACIENTES",
    "CONSENTIMIENTO",
    "USUARIOS_ROLES",
    "INVENTARIO",
    "CRONOGRAMA",
    "ASISTENCIA",
    "DONACIONES",
    "GALERIA",
    "CONTENIDO",
    "SOLICITUDES",
    "SISTEMA",
)
AUDIT_SEVERITIES = ("INFO", "WARNING", "CRITICAL")
SYSTEM_ACTOR_ROLE = "Sistema"


class AuditLog(Base):
    __tablename__ = "audit_logs"

    id: Mapped[uuid.UUID] = mapped_column(
        Uuid, primary_key=True, server_default=func.gen_random_uuid()
    )
    date: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
    actor: Mapped[str] = mapped_column(String)
    actor_role: Mapped[str] = mapped_column(String)
    category: Mapped[str] = mapped_column(String)
    severity: Mapped[str] = mapped_column(String)
    action: Mapped[str] = mapped_column(String)
    detail: Mapped[str] = mapped_column(Text)
    ip_address: Mapped[str | None] = mapped_column(String)
    # Eventos repetidos agrupados en una fila (por ejemplo, intentos fallidos)
    group_key: Mapped[str | None] = mapped_column(String)
    occurrences: Mapped[int] = mapped_column(Integer, default=1)
    last_occurred_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now()
    )
