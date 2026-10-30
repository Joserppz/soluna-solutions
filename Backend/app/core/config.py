"""Configuración tipada del Backend (pydantic-settings).

Los valores salen de variables de entorno y, en desarrollo, de ``Backend/.env``. Las
variables de entorno tienen prioridad sobre el archivo: así Docker y Cloud Run fijan sus
propios valores. Si falta una obligatoria o tiene un formato inválido, la API no arranca.
"""

from functools import lru_cache
from pathlib import Path
from typing import Annotated, Literal

from pydantic import Field, SecretStr, field_validator, model_validator
from pydantic_settings import BaseSettings, NoDecode, SettingsConfigDict

ENV_FILE = Path(__file__).resolve().parents[2] / ".env"
JWT_SECRET_PLACEHOLDER = "reemplazar-por-un-secreto-aleatorio"  # noqa: S105 - valor de .env.example
# Clave secreta de prueba de Cloudflare Turnstile: siempre aprueba (solo desarrollo)
TURNSTILE_TEST_SECRET = "1x0000000000000000000000000000000AA"  # noqa: S105 - clave pública de prueba


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

    # Límite de peticiones (tabla rate_limits). Solo se apaga en las pruebas automáticas
    rate_limits_enabled: bool = True

    # Proxies de confianza que agregan una IP al final de X-Forwarded-For (Cloud Run: 1)
    proxy_trusted_hops: int = Field(default=0, ge=0, le=5)

    # Dirección del frontend: los enlaces de los correos apuntan aquí
    frontend_url: str = "http://localhost:5173"

    # Correos transaccionales (verificación y recuperación de contraseña)
    email_provider: Literal["console", "resend", "brevo"] = "console"
    email_from: str = "ASPAR <no-responder@aspar.com>"
    resend_api_key: SecretStr = SecretStr("")
    brevo_api_key: SecretStr = SecretStr("")
    email_verification_hours: int = Field(default=24, ge=1, le=168)
    password_reset_minutes: int = Field(default=60, ge=10, le=1440)
    temp_password_hours: int = Field(default=72, ge=1, le=720)

    # Cloudflare Turnstile (CAPTCHA) de los formularios públicos
    turnstile_secret_key: SecretStr = SecretStr(TURNSTILE_TEST_SECRET)

    @field_validator("turnstile_secret_key", mode="before")
    @classmethod
    def _turnstile_por_defecto(cls, value: object) -> object:
        # TURNSTILE_SECRET_KEY vacío en .env = clave de prueba (en prod se rechaza más abajo)
        return value or TURNSTILE_TEST_SECRET

    # "Continuar con Google": Client ID de Google Cloud (vacío = desactivado)
    google_client_id: str = ""

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

    @model_validator(mode="after")
    def _produccion_segura(self) -> "Settings":
        if self.env != "prod":
            return self
        problems = []
        if self.email_provider == "console":
            problems.append("EMAIL_PROVIDER no puede ser console (los correos no llegarían)")
        if self.turnstile_secret_key.get_secret_value() == TURNSTILE_TEST_SECRET:
            problems.append("TURNSTILE_SECRET_KEY es la clave de prueba de Cloudflare")
        if not self.cookie_secure:
            problems.append("COOKIE_SECURE debe ser true")
        if not self.rate_limits_enabled:
            problems.append("RATE_LIMITS_ENABLED debe ser true")
        if any(not origin.startswith("https://") for origin in self.cors_origins):
            problems.append("CORS_ORIGINS solo admite orígenes https://")
        if problems:
            raise ValueError("Configuración insegura para producción: " + "; ".join(problems))
        return self

    @field_validator("frontend_url")
    @classmethod
    def _url_sin_barra(cls, value: str) -> str:
        return value.rstrip("/")

    @property
    def is_prod(self) -> bool:
        return self.env == "prod"


@lru_cache
def get_settings() -> Settings:
    return Settings()


settings = get_settings()
