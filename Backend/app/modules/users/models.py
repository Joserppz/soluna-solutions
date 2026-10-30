from datetime import datetime

from sqlalchemy import Boolean, DateTime, Integer, String, func
from sqlalchemy.orm import Mapped, mapped_column

from app.core.database import Base

# Roles del personal (Frontend/src/types/aspar.ts y la migración 001)
ROLES = ("Administrador", "Coordinador", "Profesional", "Recepción", "Voluntario")

# Roles que pueden registrar y editar fichas de pacientes
PATIENT_EDITOR_ROLES = ("Administrador", "Coordinador", "Profesional", "Recepción")

# RNF-06: roles que pueden ver la anamnesis (además se exige consentimiento y acceso Activo)
CLINICAL_ROLES = ("Administrador", "Coordinador", "Profesional")


class User(Base):
    __tablename__ = "users"

    id: Mapped[str] = mapped_column(String, primary_key=True)
    name: Mapped[str] = mapped_column(String)
    email: Mapped[str] = mapped_column(String)
    password_hash: Mapped[str] = mapped_column(String)
    role: Mapped[str] = mapped_column(String)
    department: Mapped[str] = mapped_column(String, default="General")
    active: Mapped[bool] = mapped_column(Boolean, default=True)
    failed_login_attempts: Mapped[int] = mapped_column(Integer, default=0)
    locked_until: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    last_login_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
