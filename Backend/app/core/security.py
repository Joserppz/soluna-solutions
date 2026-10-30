"""Contraseñas con bcrypt (RNF-02), tokens JWT HS256 (RF-01) y tokens CSRF."""

import hashlib
import hmac
import time
from datetime import datetime
from typing import Any

import bcrypt
import jwt

from app.core.config import settings

JWT_ALGORITHM = "HS256"
BCRYPT_ROUNDS = 12


def hash_password(password: str) -> str:
    return bcrypt.hashpw(password.encode(), bcrypt.gensalt(BCRYPT_ROUNDS)).decode()


def verify_password(password: str, password_hash: str) -> bool:
    try:
        return bcrypt.checkpw(password.encode(), password_hash.encode())
    except ValueError:
        return False


def create_access_token(*, user_id: str, session_id: str, expires_at: datetime) -> str:
    """JWT estándar (iat y exp en segundos) que solo identifica la sesión.

    El rol, la inactividad y la revocación se validan en la tabla sessions en cada
    petición: el token no lleva datos personales ni permisos.
    """
    issued_at = int(time.time())
    payload = {
        "sub": user_id,
        "sid": session_id,
        "iat": issued_at,
        "exp": int(expires_at.timestamp()),
    }
    return jwt.encode(payload, settings.jwt_secret.get_secret_value(), algorithm=JWT_ALGORITHM)


def decode_access_token(token: str) -> dict[str, Any]:
    return jwt.decode(
        token,
        settings.jwt_secret.get_secret_value(),
        algorithms=[JWT_ALGORITHM],
        options={"require": ["sub", "sid", "iat", "exp"]},
    )


def csrf_token_for(session_id: str) -> str:
    """Token CSRF ligado a la sesión (patrón double-submit firmado).

    Se entrega en una cookie legible por el frontend; el frontend lo repite en el
    encabezado X-CSRF-Token. Otro sitio no puede leer la cookie, así que no puede
    falsificar el encabezado.
    """
    key = settings.jwt_secret.get_secret_value().encode()
    return hmac.new(key, f"csrf:{session_id}".encode(), hashlib.sha256).hexdigest()


def csrf_token_matches(session_id: str, token: str | None) -> bool:
    return bool(token) and hmac.compare_digest(csrf_token_for(session_id), token)
