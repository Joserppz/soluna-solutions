import uuid

from fastapi import APIRouter, Depends, Query, status
from fastapi.responses import Response

from app.core.database import DbSession
from app.core.pagination import Pagination
from app.core.reports import (
    EXPORT_PAGE,
    EXPORT_PERMISSION,
    EXPORT_RESPONSES,
    FORMAT_QUERY,
    DateRange,
    FileFormat,
    Range,
    Report,
    Sheet,
    describe,
    download,
    exportable,
    log_query,
)
from app.modules.auth.dependencies import CurrentUser, require_permission
from app.modules.users import service as user_service
from app.modules.users.models import USERS_MANAGE
from app.modules.users.schemas import (
    PasswordResetOut,
    UserApprove,
    UserCreate,
    UserCreated,
    UserOut,
    UserPage,
    UserUpdate,
    to_user_out,
)

router = APIRouter(prefix="/api/v1/users", tags=["Usuarios y roles"])

admin_only = require_permission(USERS_MANAGE)
exporters = require_permission(USERS_MANAGE, EXPORT_PERMISSION)


ROLE_QUERY = Query(
    default=None,
    max_length=30,
    description="Clave del rol, o «pendiente» para las cuentas que esperan aprobación",
)


def _described(period: DateRange, search: str | None, role: str | None) -> dict[str, str]:
    return describe(period, {"Búsqueda": search, "Rol": role})


@router.get("", response_model=UserPage, response_model_by_alias=True)
def list_users(
    db: DbSession,
    page: Pagination,
    period: Range,
    search: str | None = Query(default=None, max_length=150),
    role: str | None = ROLE_QUERY,
    current: CurrentUser = Depends(admin_only),
):
    """Equipo, con búsqueda por nombre o correo, filtro por rol y fecha de alta."""
    result = user_service.list_users(db, search, page, role, period)
    log_query("Equipo", _described(period, search, role), result.total)
    return UserPage.of(result, to_user_out)


@router.get("/export", response_class=Response, responses=EXPORT_RESPONSES)
def export_users(
    db: DbSession,
    period: Range,
    search: str | None = Query(default=None, max_length=150),
    role: str | None = ROLE_QUERY,
    file_format: FileFormat = FORMAT_QUERY,
    current: CurrentUser = Depends(exporters),
):
    """Todas las cuentas del filtro (sin contraseñas ni datos de sesión)."""
    users = exportable(user_service.list_users(db, search, EXPORT_PAGE, role, period))
    sheet = Sheet(
        "Equipo",
        [
            "Nombre",
            "Correo",
            "Rol",
            "Área",
            "Activa",
            "Correo confirmado",
            "Último ingreso",
            "Alta",
        ],
        [
            [
                user.name,
                user.email,
                user.role_name,
                user.department,
                user.active,
                user.email_verified,
                user.last_login_at,
                user.created_at,
            ]
            for user in users
        ],
    )
    report = Report(
        "Equipo", "equipo", "USUARIOS_ROLES", _described(period, search, role), "WARNING"
    )
    return download(db, current, report, [sheet], file_format)


@router.post(
    "",
    response_model=UserCreated,
    response_model_by_alias=True,
    status_code=status.HTTP_201_CREATED,
)
def create_user(db: DbSession, payload: UserCreate, current: CurrentUser = Depends(admin_only)):
    user, generated = user_service.create_user(db, payload, current)
    return UserCreated(**to_user_out(user).model_dump(), temporary_password=generated)


@router.patch("/{user_id}", response_model=UserOut, response_model_by_alias=True)
def update_user(
    user_id: uuid.UUID,
    payload: UserUpdate,
    db: DbSession,
    current: CurrentUser = Depends(admin_only),
):
    return to_user_out(user_service.update_user(db, user_id, payload, current))


@router.post("/{user_id}/approve", response_model=UserOut, response_model_by_alias=True)
def approve_user(
    user_id: uuid.UUID,
    payload: UserApprove,
    db: DbSession,
    current: CurrentUser = Depends(admin_only),
):
    """Asigna un rol a una cuenta «Pendiente de aprobación»."""
    return to_user_out(user_service.approve_user(db, user_id, payload, current))


@router.post(
    "/{user_id}/reset-password", response_model=PasswordResetOut, response_model_by_alias=True
)
def reset_password(
    user_id: uuid.UUID,
    db: DbSession,
    current: CurrentUser = Depends(admin_only),
):
    generated = user_service.reset_password(db, user_id, current)
    return PasswordResetOut(
        message="Contraseña restablecida; las sesiones activas del usuario se cerraron.",
        temporary_password=generated,
    )
