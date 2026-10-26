import jwt
import pytest

from app.core import security


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


def test_token_incluye_sesion_y_expira_en_milisegundos():
    token = security.create_access_token(
        user_id="u-1", session_id="s-1", email="a@b.co", name="Ana", role="Administrador"
    )
    payload = security.decode_access_token(token)

    assert payload["sub"] == "u-1"
    assert payload["sid"] == "s-1"
    assert payload["exp"] - payload["iat"] == security.SESSION_MAX_AGE_SECONDS * 1000
    assert payload["exp"] > security.now_ms()


def test_token_alterado_es_rechazado():
    token = security.create_access_token(
        user_id="u-1", session_id="s-1", email="a@b.co", name="Ana", role="Voluntario"
    )
    forged = jwt.encode(
        {**jwt.decode(token, options={"verify_signature": False}), "role": "Administrador"},
        "otro-secreto-de-un-atacante-de-32-bytes",
        algorithm="HS256",
    )

    with pytest.raises(jwt.InvalidSignatureError):
        security.decode_access_token(forged)


def test_token_expirado_es_rechazado():
    expired = jwt.encode(
        {"sub": "u-1", "sid": "s-1", "exp": security.now_ms() - 1},
        security.JWT_SECRET,
        algorithm="HS256",
    )

    with pytest.raises(jwt.ExpiredSignatureError):
        security.decode_access_token(expired)
