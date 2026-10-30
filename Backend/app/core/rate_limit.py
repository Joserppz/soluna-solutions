"""Límite de peticiones respaldado en la tabla rate_limits (S2 / S3).

Los contadores viven en PostgreSQL, así que valen para todas las instancias de Cloud Run.
Cada conteo se guarda en su propia transacción: aunque la petición falle (credenciales
incorrectas, CAPTCHA inválido), el intento ya quedó contado.
"""

from datetime import UTC, datetime, timedelta

from sqlalchemy import text

from app.core.config import settings
from app.core.errors import TooManyRequests

TOO_MANY = "Demasiados intentos. Espera {minutes} minutos y vuelve a intentarlo."

_HIT = text(
    """
    insert into public.rate_limits (bucket, window_start, hits, expires_at)
    values (:bucket, :window_start, 1, :expires_at)
    on conflict (bucket, window_start) do update set hits = public.rate_limits.hits + 1
    returning hits
    """
)
_CLEAN_BUCKET = text("delete from public.rate_limits where bucket = :bucket and expires_at < :now")


def hit(bucket: str, limit: int, window_seconds: int) -> None:
    """Cuenta un intento en ``bucket`` y lanza 429 si superó ``limit`` en la ventana."""
    if not settings.rate_limits_enabled:
        return
    from app.core.database import engine

    now = datetime.now(UTC)
    start = datetime.fromtimestamp(int(now.timestamp()) // window_seconds * window_seconds, UTC)
    expires = start + timedelta(seconds=window_seconds)
    with engine.begin() as conn:
        conn.execute(_CLEAN_BUCKET, {"bucket": bucket, "now": now})
        hits = conn.execute(
            _HIT, {"bucket": bucket[:200], "window_start": start, "expires_at": expires}
        ).scalar_one()
    if hits > limit:
        retry_after = max(1, int((expires - now).total_seconds()))
        raise TooManyRequests(
            TOO_MANY.format(minutes=max(1, round(retry_after / 60))), retry_after=retry_after
        )


def by_ip(action: str, ip: str | None) -> str:
    return f"{action}:ip:{ip or 'desconocida'}"


def by_account(action: str, email: str) -> str:
    return f"{action}:cuenta:{email.strip().lower()}"


# (límite, ventana en segundos) por acción
LOGIN_PER_IP = (30, 15 * 60)
LOGIN_PER_ACCOUNT = (10, 15 * 60)
GOOGLE_PER_IP = (30, 15 * 60)
REGISTER_PER_IP = (5, 60 * 60)
EMAIL_PER_IP = (5, 60 * 60)
EMAIL_PER_ACCOUNT = (3, 60 * 60)
TOKEN_PER_IP = (20, 60 * 60)
