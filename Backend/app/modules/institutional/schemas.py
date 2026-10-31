"""Contenido del sitio por sección (camelCase).

Cada sección tiene sus campos: texto plano (sin HTML), con límites de largo. El frontend
lo muestra escapado, así que nadie puede inyectar código en el sitio.
"""

import datetime as dt
import re
from typing import Any

from pydantic import ConfigDict, Field, field_validator

from app.core.schemas import CamelModel

SOCIAL_DOMAINS = {
    "facebook": ("facebook.com", "fb.com"),
    "instagram": ("instagram.com",),
    "tiktok": ("tiktok.com",),
}


class _Content(CamelModel):
    model_config = ConfigDict(extra="forbid")

    titulo: str = Field(default="", max_length=150)


class PresentacionContent(_Content):
    subtitulo: str = Field(default="", max_length=300)
    texto: str = Field(default="", max_length=2000)


class MisionVisionContent(_Content):
    mision: str = Field(default="", max_length=1500)
    vision: str = Field(default="", max_length=1500)


class HistoriaContent(_Content):
    texto: str = Field(default="", max_length=5000)


class ComoParticiparContent(_Content):
    texto: str = Field(default="", max_length=2000)
    pasos: list[str] = Field(default_factory=list, max_length=6)


class Pregunta(CamelModel):
    model_config = ConfigDict(extra="forbid")

    pregunta: str = Field(min_length=3, max_length=200)
    respuesta: str = Field(min_length=3, max_length=1500)


class PreguntasFrecuentesContent(_Content):
    preguntas: list[Pregunta] = Field(default_factory=list, max_length=20)


class DonacionesContent(_Content):
    texto: str = Field(default="", max_length=1000)
    titular: str = Field(default="", max_length=150)
    banco: str = Field(default="", max_length=80)
    cuenta: str = Field(default="", max_length=40)
    # Imagen del QR bancario (subida a la galería o al hosting del sitio)
    qr_url: str = Field(default="", max_length=500)

    @field_validator("qr_url")
    @classmethod
    def https_only(cls, value: str) -> str:
        if value and not value.startswith("https://"):
            raise ValueError("La imagen del QR debe ser un enlace https://.")
        return value


def _official(network: str, value: str) -> str:
    if not value:
        return value
    match = re.match(r"^https://([a-z0-9.-]+)/", value.lower() + "/")
    host = match.group(1) if match else ""
    # El dominio exacto o un subdominio (www., m.): «notfacebook.com» no sirve
    if not any(host == domain or host.endswith("." + domain) for domain in SOCIAL_DOMAINS[network]):
        raise ValueError(f"Pega el enlace oficial de {network.capitalize()} (https://...).")
    return value


class RedesContactoContent(_Content):
    facebook: str = Field(default="", max_length=300)
    instagram: str = Field(default="", max_length=300)
    tiktok: str = Field(default="", max_length=300)
    whatsapp: str = Field(default="", max_length=15)
    telefono: str = Field(default="", max_length=20)
    correo: str = Field(default="", max_length=150)
    direccion: str = Field(default="", max_length=300)

    @field_validator("facebook", "instagram", "tiktok")
    @classmethod
    def official_links(cls, value: str, info) -> str:
        return _official(info.field_name, value.strip())

    @field_validator("whatsapp")
    @classmethod
    def digits(cls, value: str) -> str:
        if value and not re.fullmatch(r"\d{7,15}", value):
            raise ValueError("El WhatsApp debe tener solo dígitos (con el código del país).")
        return value


SECTION_MODELS: dict[str, type[_Content]] = {
    "presentacion": PresentacionContent,
    "mision_vision": MisionVisionContent,
    "historia": HistoriaContent,
    "como_participar": ComoParticiparContent,
    "preguntas_frecuentes": PreguntasFrecuentesContent,
    "donaciones": DonacionesContent,
    "redes_contacto": RedesContactoContent,
}


class SectionDraftIn(CamelModel):
    title: str | None = Field(default=None, min_length=3, max_length=150)
    # Campos de la sección (ver SECTION_MODELS); los que no se envían quedan vacíos
    content: dict[str, Any]


class SocialLinksIn(CamelModel):
    """«Redes sociales» (diseño pág. 14): vacío = ese ícono no aparece en el sitio."""

    facebook: str = Field(default="", max_length=300)
    instagram: str = Field(default="", max_length=300)
    tiktok: str = Field(default="", max_length=300)


class SectionOut(CamelModel):
    key: str
    title: str
    draft_content: dict[str, Any]
    published_content: dict[str, Any] | None
    has_unpublished_changes: bool
    draft_updated_at: dt.datetime | None
    published_at: dt.datetime | None


class PublicSectionOut(CamelModel):
    key: str
    title: str
    content: dict[str, Any]
    published_at: dt.datetime | None
