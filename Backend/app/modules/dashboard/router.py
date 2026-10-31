from fastapi import APIRouter, Depends

from app.core.database import DbSession
from app.modules.auth.dependencies import CurrentUser, require_permission
from app.modules.dashboard import service as dashboard_service
from app.modules.dashboard.schemas import DashboardSummary, UpcomingActivity
from app.modules.users.models import PERMISSION_KEYS

router = APIRouter(prefix="/api/v1/dashboard", tags=["Panel"])

# Cualquier rol con al menos un permiso; una cuenta pendiente de aprobación no entra
staff = require_permission(*PERMISSION_KEYS, any_of=True)


@router.get("/summary", response_model=DashboardSummary, response_model_by_alias=True)
def summary(db: DbSession, current: CurrentUser = Depends(staff)):
    """«Para revisar», próxima actividad, asistencia de los últimos 8 sábados y afiliados."""
    data = dashboard_service.summary(db, current)
    if data["upcoming"] is not None:
        data["upcoming"] = [
            UpcomingActivity(
                id=s.id,
                title=s.title,
                date=s.date,
                start_time=s.start_time,
                end_time=s.end_time,
                location=s.location,
                status=s.status,
                cancellation_note=s.cancellation_note,
            )
            for s in data["upcoming"]
        ]
    return DashboardSummary(**data)
