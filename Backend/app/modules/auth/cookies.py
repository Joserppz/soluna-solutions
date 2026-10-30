"""Cookies de la sesión: el token viaja en una cookie HttpOnly que JavaScript no puede leer.

- aspar_session: JWT de la sesión. HttpOnly, Secure, SameSite=Lax, solo para /api.
- aspar_csrf: token CSRF que el frontend lee y repite en el encabezado X-CSRF-Token.
"""

from fastapi import Response

from app.core.config import settings
from app.core.security import create_access_token, csrf_token_for
from app.modules.auth.models import UserSession

SESSION_COOKIE = "aspar_session"
CSRF_COOKIE = "aspar_csrf"
CSRF_HEADER = "X-CSRF-Token"
SESSION_COOKIE_PATH = "/api"


def set_session_cookies(response: Response, session: UserSession, max_age: int) -> str:
    """Escribe ambas cookies y devuelve el token CSRF (también va en el cuerpo)."""
    token = create_access_token(
        user_id=str(session.user_id), session_id=str(session.id), expires_at=session.expires_at
    )
    csrf = csrf_token_for(str(session.id))
    common = {
        "max_age": max_age,
        "secure": settings.cookie_secure,
        "samesite": settings.cookie_samesite,
        "domain": settings.cookie_domain,
    }
    response.set_cookie(SESSION_COOKIE, token, httponly=True, path=SESSION_COOKIE_PATH, **common)
    response.set_cookie(CSRF_COOKIE, csrf, httponly=False, path="/", **common)
    return csrf


def clear_session_cookies(response: Response) -> None:
    for name, path in ((SESSION_COOKIE, SESSION_COOKIE_PATH), (CSRF_COOKIE, "/")):
        response.delete_cookie(
            name,
            path=path,
            domain=settings.cookie_domain,
            secure=settings.cookie_secure,
            samesite=settings.cookie_samesite,
        )
