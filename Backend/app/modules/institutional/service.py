"""Contenido del sitio (RF-07 / RF-08, diseño pág. 14): borrador y publicación por sección.

«Guardar borrador» no cambia el sitio; «Publicar cambios» copia el borrador a la
versión publicada. Los enlaces a redes sociales se guardan y publican de inmediato.
"""

from pydantic import ValidationError as PydanticValidationError
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.core import clock
from app.core.errors import Conflict, NotFound, ValidationError
from app.modules.audit import service as audit_service
from app.modules.auth.dependencies import CurrentUser
from app.modules.institutional.models import InstitutionalSection
from app.modules.institutional.schemas import (
    SECTION_MODELS,
    RedesContactoContent,
    SocialLinksIn,
)

NOT_FOUND = "Sección no encontrada."


def list_sections(db: Session) -> list[InstitutionalSection]:
    order = list(SECTION_MODELS)
    sections = list(db.scalars(select(InstitutionalSection)))
    return sorted(sections, key=lambda s: order.index(s.key) if s.key in order else len(order))


def get_section(db: Session, key: str) -> InstitutionalSection:
    section = db.scalar(select(InstitutionalSection).where(InstitutionalSection.key == key))
    if section is None or key not in SECTION_MODELS:
        raise NotFound(NOT_FOUND)
    return section


def _validated(key: str, content: dict) -> dict:
    try:
        model = SECTION_MODELS[key].model_validate(content)
    except PydanticValidationError as exc:
        error = exc.errors()[0]
        field = ".".join(str(part) for part in error["loc"]) or "contenido"
        message = str(error["msg"]).removeprefix("Value error, ")
        raise ValidationError(f"Revisa «{field}»: {message}") from exc
    return model.model_dump(by_alias=True)


def _audit(
    db: Session,
    current: CurrentUser,
    section: InstitutionalSection,
    action: str,
    severity: str = "INFO",
) -> None:
    audit_service.audit(
        db,
        current,
        category="CONTENIDO",
        severity=severity,
        action=action,
        detail=f"Sección «{section.title}» ({section.key})",
    )


def save_draft(
    db: Session, key: str, title: str | None, content: dict, current: CurrentUser
) -> InstitutionalSection:
    section = get_section(db, key)
    section.draft_content = _validated(key, content)
    if title:
        section.title = title.strip()
    section.draft_updated_by = current.user.id
    section.draft_updated_at = clock.now()
    _audit(db, current, section, "Borrador de contenido guardado")
    db.flush()
    return section


def publish(db: Session, key: str, current: CurrentUser) -> InstitutionalSection:
    section = get_section(db, key)
    if not any(section.draft_content.values()):
        raise Conflict("La sección está vacía: guarda un borrador antes de publicar.")
    if section.draft_content == section.published_content:
        raise Conflict("No hay cambios sin publicar en esta sección.")
    section.published_content = dict(section.draft_content)
    section.published_by = current.user.id
    section.published_at = clock.now()
    _audit(db, current, section, "Publicación de contenido en el sitio", "WARNING")
    db.flush()
    return section


def save_social_links(
    db: Session, data: SocialLinksIn, current: CurrentUser
) -> InstitutionalSection:
    """Guarda los enlaces y los publica a la vez, sin tocar el resto de la sección."""
    section = get_section(db, "redes_contacto")
    links = _validated("redes_contacto", data.model_dump(by_alias=True))
    links = {network: links[network] for network in ("facebook", "instagram", "tiktok")}
    base = RedesContactoContent().model_dump(by_alias=True)
    section.draft_content = base | dict(section.draft_content) | links
    section.published_content = base | dict(section.published_content or {}) | links
    section.published_by = current.user.id
    section.published_at = clock.now()
    now = clock.now()
    section.draft_updated_by, section.draft_updated_at = current.user.id, now
    _audit(db, current, section, "Enlaces a redes sociales actualizados", "WARNING")
    db.flush()
    return section


def public_sections(db: Session) -> list[InstitutionalSection]:
    return [s for s in list_sections(db) if s.published_content is not None]
