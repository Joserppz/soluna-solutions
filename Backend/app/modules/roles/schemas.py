"""DTOs de la matriz de roles y permisos (camelCase)."""

from pydantic import Field

from app.core.schemas import CamelModel
from app.modules.users.models import PermissionKey, Role


class PermissionOut(CamelModel):
    key: PermissionKey
    description: str
    # Datos clínicos o control del sistema: el panel advierte antes de dárselo a un rol
    is_sensitive: bool


class RoleOut(CamelModel):
    key: str
    name: str
    description: str
    # El rol del sistema (admin) siempre tiene todos los permisos y no se edita
    is_system: bool
    permissions: list[PermissionKey]
    members: int = Field(description="Cuentas activas con este rol")


class RoleMatrixOut(CamelModel):
    """«Qué puede ver cada rol»: columnas = roles, filas = permisos."""

    permissions: list[PermissionOut]
    roles: list[RoleOut]


class RolePermissionsUpdate(CamelModel):
    # Lista completa de permisos que tendrá el rol (reemplaza a la anterior)
    permissions: list[PermissionKey] = Field(max_length=50)
    # true después de mostrar la advertencia: el rol recibirá permisos sensibles
    confirm_sensitive: bool = False


def to_role_out(role: Role, members: int) -> RoleOut:
    return RoleOut(
        key=role.key,
        name=role.name,
        description=role.description,
        is_system=role.is_system,
        permissions=[permission.key for permission in role.permissions],
        members=members,
    )
