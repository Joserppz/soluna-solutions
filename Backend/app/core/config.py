"""Configuración tipada del Backend (pydantic-settings).

Los valores salen de variables de entorno y, en desarrollo, de ``Backend/.env``. Las
variables de entorno tienen prioridad sobre el archivo: así Docker y Cloud Run fijan sus
propios valores. Si falta una obligatoria o tiene un formato inválido, la API no arranca.
"""

from functools import lru_cache
from pathlib import Path
from typing import Annotated, Literal

from pydantic import Field, SecretStr, field_validator
from pydantic_settings import BaseSettings, NoDecode, SettingsConfigDict

ENV_FILE = Path(__file__).resolve().parents[2] / ".env"
JWT_SECRET_PLACEHOLDER = "reemplazar-por-un-secreto-aleatorio"  # noqa: S105 - valor de .env.example


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=ENV_FILE, env_file_encoding="utf-8", extra="ignore")

    # dev: tu PC y Docker · test: pytest · prod: Google Cloud Run
    env: Literal["dev", "test", "prod"] = "dev"
    log_level: Literal["DEBUG", "INFO", "WARNING", "ERROR"] = "INFO"

    # API: Transaction Pooler de Supabase (6543) con DB_POOL=null; Docker y local con "queue"
    database_url: str
    # Migraciones: Session Pooler (5432). Si se omite, se usa database_url
    migration_database_url: str | None = None
    db_pool: Literal["queue", "null"] = "queue"
    db_pool_size: int = Field(default=5, ge=1, le=50)
    db_max_overflow: int = Field(default=5, ge=0, le=50)
    db_pool_recycle_seconds: int = Field(default=1800, ge=60)

    jwt_secret: SecretStr
    session_max_age_seconds: int = Field(default=1800, ge=60)
    session_idle_limit_seconds: int = Field(default=900, ge=60)
    # Tope absoluto de una sesión aunque se renueve (8 horas)
    session_absolute_max_seconds: int = Field(default=28800, ge=300)
    cors_origins: Annotated[list[str], NoDecode] = ["http://localhost:5173"]

    # Cookies de sesión. En producción: COOKIE_DOMAIN=.aspar.com para compartirlas entre
    # aspar.com (frontend) y api.aspar.com (API). Vacío = solo el dominio de la API.
    cookie_domain: str | None = None
    cookie_secure: bool = True
    cookie_samesite: Literal["lax", "strict"] = "lax"

    # Proxies de confianza que agregan una IP al final de X-Forwarded-For (Cloud Run: 1)
    proxy_trusted_hops: int = Field(default=0, ge=0, le=5)

    supabase_url: str = ""
    supabase_service_role_key: SecretStr = SecretStr("")
    patient_documents_bucket: str = "documentos-pacientes"
    signed_url_seconds: int = Field(default=300, ge=30, le=3600)

    @field_validator("jwt_secret")
    @classmethod
    def _secret_aleatorio(cls, value: SecretStr) -> SecretStr:
        secret = value.get_secret_value()
        if len(secret) < 32 or secret == JWT_SECRET_PLACEHOLDER:
            raise ValueError(
                "JWT_SECRET debe ser un valor aleatorio de al menos 32 caracteres. Genera uno "
                'con: python -c "import secrets; print(secrets.token_urlsafe(32))"'
            )
        return value

    @field_validator("cors_origins", mode="before")
    @classmethod
    def _lista_separada_por_comas(cls, value: object) -> object:
        if isinstance(value, str):
            return [origin.strip() for origin in value.split(",") if origin.strip()]
        return value

    @field_validator("cookie_domain", mode="before")
    @classmethod
    def _dominio_vacio_es_none(cls, value: object) -> object:
        return value or None

    @field_validator("supabase_url")
    @classmethod
    def _sin_barra_final(cls, value: str) -> str:
        return value.rstrip("/")

    @property
    def is_prod(self) -> bool:
        return self.env == "prod"


@lru_cache
def get_settings() -> Settings:
    return Settings()


settings = get_settings()
