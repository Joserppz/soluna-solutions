"""Registro de todos los modelos SQLAlchemy de los módulos.

Importarlo garantiza que SQLAlchemy conozca todas las tablas, también las que se
relacionan entre módulos por clave foránea (por ejemplo, patients.created_by -> users).
"""

from app.modules.attendance.models import Attendance
from app.modules.audit.models import AuditLog
from app.modules.auth.models import UserSession
from app.modules.documents.models import PatientDocument
from app.modules.donations.models import Donation, DonationGoal, DonationGoalMilestone
from app.modules.evaluations.models import PatientEvaluation
from app.modules.inquiries.models import Inquiry, InquiryNote
from app.modules.institutional.models import InstitutionalSection
from app.modules.inventory.models import InventoryItem, InventoryMovement
from app.modules.media.models import MediaAlbum, MediaAsset, MediaPatientTag
from app.modules.patients.models import Patient, PatientContact
from app.modules.schedules.models import Schedule
from app.modules.users.models import Permission, Role, User

__all__ = [
    "Attendance",
    "AuditLog",
    "Donation",
    "DonationGoal",
    "DonationGoalMilestone",
    "Inquiry",
    "InquiryNote",
    "InstitutionalSection",
    "InventoryItem",
    "InventoryMovement",
    "MediaAlbum",
    "MediaAsset",
    "MediaPatientTag",
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
