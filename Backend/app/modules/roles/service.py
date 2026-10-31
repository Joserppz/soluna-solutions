"""Matriz de roles y permisos (RF-11, diseño pág. 18 «Qué puede ver cada rol»).

Administración ve qué puede hacer cada rol y cambia los permisos de los roles que no
son del sistema. El rol admin es inmutable: siempre tiene todos los permisos (la base
también lo impide, ver 001_base.sql). Dar un permiso sensible exige confirmarlo.
"""

from sqlalchemy.orm import Session

from app.core.errors import Conflict, NotFound
from app.modules.audit import service as audit_service
from app.modules.auth.dependencies import CurrentUser
from app.modules.roles import repository as role_repository
from app.modules.users import repository as user_repository
from app.modules.users.models import Permission, Role

SYSTEM_ROLE_LOCKED = (
    "El rol de Administración siempre tiene todos los permisos y no se puede modificar."
)


def matrix(db: Session) -> tuple[list[Permission], list[tuple[Role, int]]]:
    members = role_repository.active_members_by_role(db)
    roles = user_repository.list_roles(db)
    return role_repository.list_permissions(db), [(role, members.get(role.id, 0)) for role in roles]


def update_permissions(
    db: Session,
    role_key: str,
    keys: list[str],
    confirm_sensitive: bool,
    current: CurrentUser,
) -> tuple[Role, int]:
    role = user_repository.get_role_by_key(db, role_key)
    if role is None:
        raise NotFound("Rol no encontrado.")
    if role.is_system:
        raise Conflict(SYSTEM_ROLE_LOCKED)

    catalog = {permission.key: permission for permission in role_repository.list_permissions(db)}
    wanted = set(keys)
    before = {permission.key for permission in role.permissions}
    added, removed = sorted(wanted - before), sorted(before - wanted)
    sensitive_added = [catalog[key] for key in added if catalog[key].is_sensitive]
    if sensitive_added and not confirm_sensitive:
        raise Conflict(
            f"Vas a dar al rol {role.name} acceso sensible: "
            + "; ".join(permission.description for permission in sensitive_added)
            + ". Confírmalo para continuar."
        )

    role.permissions = [catalog[key] for key in sorted(wanted)]
    if added or removed:
        audit_service.audit(
            db,
            current,
            category="USUARIOS_ROLES",
            severity="CRITICAL" if sensitive_added else "WARNING",
            action="Cambio de permisos de un rol",
            detail=(
                f"Rol {role.name}: agregó [{', '.join(added) or '-'}], "
                f"quitó [{', '.join(removed) or '-'}]"
            ),
        )
    db.flush()
    members = role_repository.active_members_by_role(db).get(role.id, 0)
    return role, members
