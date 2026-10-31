"""Registro de todos los modelos SQLAlchemy de los módulos.

Importarlo garantiza que SQLAlchemy conozca todas las tablas, también las que se
relacionan entre módulos por clave foránea (por ejemplo, patients.created_by -> users).
"""

from app.modules.audit.models import AuditLog
from app.modules.auth.models import UserSession
from app.modules.documents.models import PatientDocument
from app.modules.evaluations.models import PatientEvaluation
from app.modules.inquiries.models import Inquiry
from app.modules.patients.models import Patient, PatientContact
from app.modules.schedules.models import Schedule
from app.modules.users.models import Permission, Role, User

__all__ = [
    "AuditLog",
    "Inquiry",
    "Patient",
    "PatientContact",
    "PatientDocument",
    "PatientEvaluation",
    "Permission",
    "Role",
    "Schedule",
    "User",
    "UserSession",
]
