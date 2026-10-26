"""Contraseñas con bcrypt (RNF-02) y tokens JWT HS256 (RF-01)."""

import time
from typing import Any

import bcrypt
import jwt

from app.core.config import JWT_SECRET, SESSION_MAX_AGE_SECONDS

JWT_ALGORITHM = "HS256"
BCRYPT_ROUNDS = 12


def hash_password(password: str) -> str:
    return bcrypt.hashpw(password.encode(), bcrypt.gensalt(BCRYPT_ROUNDS)).decode()


def verify_password(password: str, password_hash: str) -> bool:
    try:
        return bcrypt.checkpw(password.encode(), password_hash.encode())
    except ValueError:
        return False


def now_ms() -> int:
    return int(time.time() * 1000)


def create_access_token(*, user_id: str, session_id: str, email: str, name: str, role: str) -> str:
    # El frontend (decodeJwtExpiry en services/aspar.ts) compara "exp" con Date.now(),
    # por eso "iat" y "exp" van en milisegundos. La expiración real se valida en la
    # tabla sessions (app/core/deps.py), no solo con el token.
    issued_at = now_ms()
    payload = {
        "sub": user_id,
        "sid": session_id,
        "email": email,
        "name": name,
        "role": role,
        "iat": issued_at,
        "exp": issued_at + SESSION_MAX_AGE_SECONDS * 1000,
    }
    return jwt.encode(payload, JWT_SECRET, algorithm=JWT_ALGORITHM)


def decode_access_token(token: str) -> dict[str, Any]:
    payload = jwt.decode(
        token,
        JWT_SECRET,
        algorithms=[JWT_ALGORITHM],
        options={"verify_exp": False, "verify_iat": False, "require": ["sub", "sid", "exp"]},
    )
    if payload["exp"] <= now_ms():
        raise jwt.ExpiredSignatureError("Token expirado")
    return payload
