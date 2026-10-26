from fastapi import APIRouter, Depends, status
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.core.deps import CurrentUser, require_roles
from app.schemas.user import (
    PasswordReset,
    PasswordResetOut,
    UserCreate,
    UserCreated,
    UserOut,
    UserUpdate,
    to_user_out,
)
from app.services import user_service

router = APIRouter(prefix="/api/v1/users", tags=["Usuarios y roles"])

admin_only = require_roles("Administrador")


@router.get("", response_model=list[UserOut], response_model_by_alias=True)
def list_users(current: CurrentUser = Depends(admin_only), db: Session = Depends(get_db)):
    return [to_user_out(user) for user in user_service.list_users(db)]


@router.post(
    "",
    response_model=UserCreated,
    response_model_by_alias=True,
    status_code=status.HTTP_201_CREATED,
)
def create_user(
    payload: UserCreate, current: CurrentUser = Depends(admin_only), db: Session = Depends(get_db)
):
    user, generated = user_service.create_user(db, payload, current)
    return UserCreated(**to_user_out(user).model_dump(), temporary_password=generated)


@router.patch("/{user_id}", response_model=UserOut, response_model_by_alias=True)
def update_user(
    user_id: str,
    payload: UserUpdate,
    current: CurrentUser = Depends(admin_only),
    db: Session = Depends(get_db),
):
    return to_user_out(user_service.update_user(db, user_id, payload, current))


@router.post(
    "/{user_id}/reset-password", response_model=PasswordResetOut, response_model_by_alias=True
)
def reset_password(
    user_id: str,
    payload: PasswordReset,
    current: CurrentUser = Depends(admin_only),
    db: Session = Depends(get_db),
):
    generated = user_service.reset_password(db, user_id, payload.password, current)
    return PasswordResetOut(
        message="Contraseña restablecida; las sesiones activas del usuario se cerraron.",
        temporary_password=generated,
    )
