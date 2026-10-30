from datetime import datetime

from sqlalchemy import DateTime, String, Text, func
from sqlalchemy.orm import Mapped, mapped_column

from app.core.database import Base

AUDIT_CATEGORIES = (
    "AUTENTICACION",
    "PACIENTES",
    "CONSENTIMIENTO",
    "USUARIOS_ROLES",
    "INVENTARIO",
    "CRONOGRAMA",
    "DONACIONES",
    "SISTEMA",
)
AUDIT_SEVERITIES = ("INFO", "WARNING", "CRITICAL")


class AuditLog(Base):
    __tablename__ = "audit_logs"

    id: Mapped[str] = mapped_column(String, primary_key=True)
    date: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
    actor: Mapped[str] = mapped_column(String)
    actor_role: Mapped[str] = mapped_column(String)
    category: Mapped[str] = mapped_column(String)
    severity: Mapped[str] = mapped_column(String)
    action: Mapped[str] = mapped_column(String)
    detail: Mapped[str] = mapped_column(Text)
    ip_address: Mapped[str] = mapped_column(String)
