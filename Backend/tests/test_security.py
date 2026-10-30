import time
from datetime import UTC, datetime, timedelta

import jwt
import pytest

from app.core import security
from app.core.config import settings


def test_bcrypt_verifica_la_contrasena_correcta():
    password_hash = security.hash_password("Admin123")

    assert password_hash.startswith("$2b$12$")
    assert security.verify_password("Admin123", password_hash)
    assert not security.verify_password("admin123", password_hash)


def test_bcrypt_acepta_hashes_generados_por_pgcrypto():
    # Hash "$2a$" creado con crypt('Admin123', gen_salt('bf')) como en la migración 001
    pgcrypto_hash = "$2a$06$bQvtz0l3DG0v2XAzrc6ph.MG93y7X/rTK/.Q5Cvy17UQQ9QVA4N7i"

    assert security.verify_password("Admin123", pgcrypto_hash)
    assert not security.verify_password("Admin1234", pgcrypto_hash)
    assert not security.verify_password("x", "no-es-un-hash")


def test_token_estandar_en_segundos_sin_datos_personales():
    expires = datetime.now(UTC) + timedelta(minutes=30)
    token = security.create_access_token(user_id="u-1", session_id="s-1", expires_at=expires)
    payload = security.decode_access_token(token)

    assert set(payload) == {"sub", "sid", "iat", "exp"}
    assert payload["exp"] == int(expires.timestamp())
    assert abs(payload["exp"] - payload["iat"] - 1800) <= 1


def test_token_alterado_es_rechazado():
    expires = datetime.now(UTC) + timedelta(minutes=30)
    token = security.create_access_token(user_id="u-1", session_id="s-1", expires_at=expires)
    forged = jwt.encode(
        {**jwt.decode(token, options={"verify_signature": False}), "sid": "otra"},
        "otro-secreto-de-un-atacante-de-32-bytes",
        algorithm="HS256",
    )

    with pytest.raises(jwt.InvalidSignatureError):
        security.decode_access_token(forged)


def test_token_expirado_es_rechazado():
    now = int(time.time())
    expired = jwt.encode(
        {"sub": "u-1", "sid": "s-1", "iat": now - 60, "exp": now - 1},
        settings.jwt_secret.get_secret_value(),
        algorithm="HS256",
    )

    with pytest.raises(jwt.ExpiredSignatureError):
        security.decode_access_token(expired)


def test_csrf_ligado_a_la_sesion():
    token = security.csrf_token_for("sesion-1")

    assert security.csrf_token_matches("sesion-1", token)
    assert not security.csrf_token_matches("sesion-2", token)
    assert not security.csrf_token_matches("sesion-1", None)
    assert not security.csrf_token_matches("sesion-1", "")
