"""Registro de todos los modelos SQLAlchemy de los módulos.

Importarlo garantiza que SQLAlchemy conozca todas las tablas, también las que se
relacionan entre módulos por clave foránea (por ejemplo, patients.created_by -> users).
"""

from app.modules.audit.models import AuditLog
from app.modules.auth.models import UserSession
from app.modules.documents.models import PatientDocument
from app.modules.patients.models import Patient
from app.modules.users.models import User

__all__ = ["AuditLog", "Patient", "PatientDocument", "User", "UserSession"]
