from fastapi import APIRouter, Depends

from app.core.database import DbSession
from app.modules.auth.dependencies import CurrentUser, require_permission
from app.modules.roles import service as role_service
from app.modules.roles.schemas import (
    PermissionOut,
    RoleMatrixOut,
    RoleOut,
    RolePermissionsUpdate,
    to_role_out,
)
from app.modules.users.models import ROLES_MANAGE, USERS_MANAGE

router = APIRouter(prefix="/api/v1/roles", tags=["Usuarios y roles"])


@router.get("", response_model=RoleMatrixOut, response_model_by_alias=True)
def get_matrix(db: DbSession, current: CurrentUser = Depends(require_permission(USERS_MANAGE))):
    """Roles con sus permisos y el catálogo de permisos (con los sensibles marcados)."""
    permissions, roles = role_service.matrix(db)
    return RoleMatrixOut(
        permissions=[
            PermissionOut(
                key=permission.key,
                description=permission.description,
                is_sensitive=permission.is_sensitive,
            )
            for permission in permissions
        ],
        roles=[to_role_out(role, members) for role, members in roles],
    )


@router.put("/{role_key}/permissions", response_model=RoleOut, response_model_by_alias=True)
def update_permissions(
    role_key: str,
    payload: RolePermissionsUpdate,
    db: DbSession,
    current: CurrentUser = Depends(require_permission(ROLES_MANAGE)),
):
    """Reemplaza los permisos de un rol que no es del sistema.

    Si se agregan permisos sensibles hay que reenviar con ``confirmSensitive: true``
    (409 con la lista de lo que se va a dar).
    """
    role, members = role_service.update_permissions(
        db, role_key, payload.permissions, payload.confirm_sensitive, current
    )
    return to_role_out(role, members)
