import uuid

from fastapi import APIRouter, Depends, status

from app.core.database import DbSession
from app.modules.auth.dependencies import CurrentUser, require_permission
from app.modules.users import service as user_service
from app.modules.users.models import USERS_MANAGE
from app.modules.users.schemas import (
    PasswordResetOut,
    UserCreate,
    UserCreated,
    UserOut,
    UserUpdate,
    to_user_out,
)

router = APIRouter(prefix="/api/v1/users", tags=["Usuarios y roles"])

admin_only = require_permission(USERS_MANAGE)


@router.get("", response_model=list[UserOut], response_model_by_alias=True)
def list_users(db: DbSession, current: CurrentUser = Depends(admin_only)):
    return [to_user_out(user) for user in user_service.list_users(db)]


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
