"""Configuración de pruebas.

Las pruebas que usan base de datos necesitan ``TEST_DATABASE_URL`` apuntando a un
PostgreSQL DEDICADO a pruebas: su esquema ``public`` se borra y se recrea.
Sin esa variable, solo se ejecutan las pruebas unitarias.
"""

import os

import pytest

TEST_DATABASE_URL = os.getenv("TEST_DATABASE_URL")

# Se fija antes de importar la app para que las pruebas nunca usen la base del .env
os.environ["DATABASE_URL"] = TEST_DATABASE_URL or "postgresql://pruebas:pruebas@localhost:1/pruebas"
os.environ["JWT_SECRET"] = "secreto-solo-para-pruebas-automatizadas-aspar"

if TEST_DATABASE_URL and "supabase" in TEST_DATABASE_URL:
    pytest.exit("TEST_DATABASE_URL no puede apuntar a Supabase: las pruebas borran el esquema.")

requires_db = pytest.mark.skipif(
    not TEST_DATABASE_URL, reason="Requiere TEST_DATABASE_URL (PostgreSQL de pruebas)"
)


@pytest.fixture(scope="session")
def migrated_engine():
    if not TEST_DATABASE_URL:
        pytest.skip("Requiere TEST_DATABASE_URL (PostgreSQL de pruebas)")
    from sqlalchemy import text

    from app.core.database import engine
    from scripts.migrate import apply_migrations

    with engine.begin() as conn:
        conn.execute(text("drop schema if exists public cascade"))
        conn.execute(text("create schema public"))
    apply_migrations(engine)
    return engine


@pytest.fixture
def db_session(migrated_engine):
    """Sesión dentro de una transacción que se revierte al terminar cada prueba."""
    from sqlalchemy.orm import Session

    connection = migrated_engine.connect()
    transaction = connection.begin()
    session = Session(bind=connection, join_transaction_mode="create_savepoint")
    try:
        yield session
    finally:
        session.close()
        transaction.rollback()
        connection.close()


@pytest.fixture
def client(db_session):
    from fastapi.testclient import TestClient

    from app.core.database import get_db
    from app.main import app

    app.dependency_overrides[get_db] = lambda: db_session
    with TestClient(app) as test_client:
        yield test_client
    app.dependency_overrides.clear()


# Usuarios sembrados por la migración 001: rol -> (correo, contraseña)
SEED_USERS = {
    "Administrador": ("dayana.rojas@ucb.edu.bo", "Admin123"),
    "Coordinador": ("coordinacion@aspar.org", "Coord2026!"),
    "Profesional": ("demo@aspar.org", "Aspar2026!"),
    "Recepción": ("recepcion@aspar.org", "Recep2026!"),
    "Voluntario": ("voluntario@aspar.org", "Voluntario2026!"),
}


@pytest.fixture
def auth_headers(client):
    """Devuelve una función rol -> cabecera Authorization con un token válido."""
    cache: dict[str, dict[str, str]] = {}

    def headers_for(role: str = "Administrador") -> dict[str, str]:
        if role not in cache:
            email, password = SEED_USERS[role]
            response = client.post(
                "/api/v1/auth/login", json={"email": email, "password": password}
            )
            assert response.status_code == 200, response.text
            cache[role] = {"Authorization": f"Bearer {response.json()['access_token']}"}
        return cache[role]

    return headers_for
