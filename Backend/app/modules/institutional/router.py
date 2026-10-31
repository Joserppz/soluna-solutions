from fastapi import APIRouter, Depends

from app.core.database import DbSession
from app.core.errors import NotFound
from app.modules.auth.dependencies import CurrentUser, require_permission
from app.modules.institutional import service as content_service
from app.modules.institutional.models import InstitutionalSection
from app.modules.institutional.schemas import (
    PublicSectionOut,
    SectionDraftIn,
    SectionOut,
    SocialLinksIn,
)
from app.modules.users.models import CONTENT_MANAGE

router = APIRouter(prefix="/api/v1/content", tags=["Galería y contenido"])
public_router = APIRouter(prefix="/api/v1/public/content", tags=["Sitio público"])

editors = require_permission(CONTENT_MANAGE)


def _out(section: InstitutionalSection) -> SectionOut:
    return SectionOut(
        key=section.key,
        title=section.title,
        draft_content=section.draft_content,
        published_content=section.published_content,
        has_unpublished_changes=section.draft_content != (section.published_content or {}),
        draft_updated_at=section.draft_updated_at,
        published_at=section.published_at,
    )


def _public(section: InstitutionalSection) -> PublicSectionOut:
    return PublicSectionOut(
        key=section.key,
        title=section.title,
        content=section.published_content,
        published_at=section.published_at,
    )


@router.get("/sections", response_model=list[SectionOut], response_model_by_alias=True)
def list_sections(db: DbSession, current: CurrentUser = Depends(editors)):
    """Las 7 secciones del sitio con su borrador, lo publicado y si hay cambios sin publicar."""
    return [_out(section) for section in content_service.list_sections(db)]


@router.get("/sections/{key}", response_model=SectionOut, response_model_by_alias=True)
def get_section(key: str, db: DbSession, current: CurrentUser = Depends(editors)):
    return _out(content_service.get_section(db, key))


@router.put("/sections/{key}", response_model=SectionOut, response_model_by_alias=True)
def save_draft(
    key: str, payload: SectionDraftIn, db: DbSession, current: CurrentUser = Depends(editors)
):
    """«Guardar borrador»: el sitio no cambia hasta publicar."""
    return _out(content_service.save_draft(db, key, payload.title, payload.content, current))


@router.post("/sections/{key}/publish", response_model=SectionOut, response_model_by_alias=True)
def publish(key: str, db: DbSession, current: CurrentUser = Depends(editors)):
    """«Publicar cambios»: el borrador pasa a verse en el sitio."""
    return _out(content_service.publish(db, key, current))


@router.put("/social-links", response_model=SectionOut, response_model_by_alias=True)
def save_social_links(
    payload: SocialLinksIn, db: DbSession, current: CurrentUser = Depends(editors)
):
    """Enlaces oficiales a Facebook, Instagram y TikTok (se publican al guardar)."""
    return _out(content_service.save_social_links(db, payload, current))


@public_router.get("", response_model=list[PublicSectionOut], response_model_by_alias=True)
def public_content(db: DbSession):
    """Secciones publicadas del sitio (sin borradores)."""
    return [_public(section) for section in content_service.public_sections(db)]


@public_router.get("/{key}", response_model=PublicSectionOut, response_model_by_alias=True)
def public_section(key: str, db: DbSession):
    section = content_service.get_section(db, key)
    if section.published_content is None:
        raise NotFound("Esa sección todavía no está publicada.")
    return _public(section)
