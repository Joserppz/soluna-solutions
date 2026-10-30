import uuid
from datetime import datetime

from sqlalchemy import (
    Boolean,
    Column,
    DateTime,
    ForeignKey,
    Integer,
    String,
    Table,
    Uuid,
    func,
)
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.core.database import Base

# Claves fijas de los roles (migración 001). El nombre visible se edita en la base.
ADMIN = "admin"
COORDINATION = "coordination"
PROFESSIONAL = "professional"
RECEPTION = "reception"
VOLUNTEER = "volunteer"
ROLE_KEYS = (ADMIN, COORDINATION, PROFESSIONAL, RECEPTION, VOLUNTEER)

# Claves de permisos (catálogo en la tabla permissions; se asignan a roles en role_permissions)
PATIENTS_READ = "patients:read"
PATIENTS_WRITE = "patients:write"
PATIENTS_READ_CLINICAL = "patients:read_clinical"
PATIENTS_WRITE_CLINICAL = "patients:write_clinical"
PATIENTS_DEACTIVATE = "patients:deactivate"
DOCUMENTS_UPLOAD = "documents:upload"
DOCUMENTS_DELETE = "documents:delete"
ATTENDANCE_WRITE = "attendance:write"
SCHEDULES_MANAGE = "schedules:manage"
INVENTORY_MANAGE = "inventory:manage"
DONATIONS_MANAGE = "donations:manage"
INQUIRIES_MANAGE = "inquiries:manage"
MEDIA_MANAGE = "media:manage"
CONTENT_MANAGE = "content:manage"
USERS_MANAGE = "users:manage"
ROLES_MANAGE = "roles:manage"
AUDIT_READ = "audit:read"

# Cuenta registrada que todavía no tiene rol: puede iniciar sesión, pero no ve el panel
PENDING_ROLE_NAME = "Pendiente de aprobación"

role_permissions = Table(
    "role_permissions",
    Base.metadata,
    Column("role_id", Uuid, ForeignKey("roles.id", ondelete="CASCADE"), primary_key=True),
    Column(
        "permission_key",
        String,
        ForeignKey("permissions.key", ondelete="CASCADE"),
        primary_key=True,
    ),
)


class Permission(Base):
    __tablename__ = "permissions"

    key: Mapped[str] = mapped_column(String, primary_key=True)
    description: Mapped[str] = mapped_column(String)
    is_sensitive: Mapped[bool] = mapped_column(Boolean, default=False)


class Role(Base):
    __tablename__ = "roles"

    id: Mapped[uuid.UUID] = mapped_column(
        Uuid, primary_key=True, server_default=func.gen_random_uuid()
    )
    key: Mapped[str] = mapped_column(String, unique=True)
    name: Mapped[str] = mapped_column(String)
    description: Mapped[str] = mapped_column(String, default="")
    is_system: Mapped[bool] = mapped_column(Boolean, default=False)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())

    permissions: Mapped[list[Permission]] = relationship(
        secondary=role_permissions, lazy="selectin", order_by=Permission.key
    )


class User(Base):
    __tablename__ = "users"

    id: Mapped[uuid.UUID] = mapped_column(
        Uuid, primary_key=True, server_default=func.gen_random_uuid()
    )
    name: Mapped[str] = mapped_column(String)
    email: Mapped[str] = mapped_column(String)
    password_hash: Mapped[str | None] = mapped_column(String)
    google_sub: Mapped[str | None] = mapped_column(String, unique=True)
    email_verified: Mapped[bool] = mapped_column(Boolean, default=False)
    must_change_password: Mapped[bool] = mapped_column(Boolean, default=False)
    temp_password_expires_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    role_id: Mapped[uuid.UUID | None] = mapped_column(ForeignKey("roles.id"))
    department: Mapped[str] = mapped_column(String, default="General")
    active: Mapped[bool] = mapped_column(Boolean, default=True)
    failed_login_attempts: Mapped[int] = mapped_column(Integer, default=0)
    locked_until: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    last_login_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    password_changed_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())

    role: Mapped[Role | None] = relationship(lazy="joined")

    @property
    def role_key(self) -> str | None:
        return self.role.key if self.role else None

    @property
    def role_name(self) -> str:
        return self.role.name if self.role else PENDING_ROLE_NAME
