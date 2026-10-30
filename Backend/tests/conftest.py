"""Configuración de pruebas.

Las pruebas que usan base de datos necesitan ``TEST_DATABASE_URL`` apuntando a un
PostgreSQL DEDICADO a pruebas: su esquema ``public`` se borra y se recrea.
Sin esa variable, solo se ejecutan las pruebas unitarias.
"""

import os
import uuid  # noqa: F401 - usado en anotaciones

import pytest

TEST_DATABASE_URL = os.getenv("TEST_DATABASE_URL")

# Se fija antes de importar la app para que las pruebas nunca usen la base del .env
os.environ["DATABASE_URL"] = TEST_DATABASE_URL or "postgresql://pruebas:pruebas@localhost:1/pruebas"
os.environ["JWT_SECRET"] = "secreto-solo-para-pruebas-automatizadas-aspar"
os.environ["ENV"] = "test"
os.environ["PROXY_TRUSTED_HOPS"] = "0"

if TEST_DATABASE_URL and "supabase" in TEST_DATABASE_URL:
    pytest.exit("TEST_DATABASE_URL no puede apuntar a Supabase: las pruebas borran el esquema.")

requires_db = pytest.mark.skipif(
    not TEST_DATABASE_URL, reason="Requiere TEST_DATABASE_URL (PostgreSQL de pruebas)"
)


@pytest.fixture(scope="session")
def migrated_engine():
    """Base de pruebas desde cero: migraciones + datos de demostración (scripts.seed_demo)."""
    if not TEST_DATABASE_URL:
        pytest.skip("Requiere TEST_DATABASE_URL (PostgreSQL de pruebas)")
    from sqlalchemy import text
    from sqlalchemy.orm import Session

    from app.core.database import engine
    from scripts.migrate import apply_migrations
    from scripts.seed_demo import seed

    with engine.begin() as conn:
        conn.execute(text("drop schema if exists public cascade"))
        conn.execute(text("create schema public"))
    apply_migrations(engine)
    with Session(engine) as session:
        seed(session)
        session.commit()
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

    from app.core.database import get_db, unit_of_work
    from app.main import app

    # Misma unidad de trabajo que en producción, pero sobre la transacción de la prueba:
    # el commit libera un savepoint y todo se revierte al terminar la prueba.
    def test_db():
        yield from unit_of_work(db_session)

    app.dependency_overrides[get_db] = test_db
    with TestClient(app) as test_client:
        yield test_client
    app.dependency_overrides.clear()


def demo_credentials(role: str | None) -> tuple[str, str]:
    """Correo y contraseña de la cuenta de demostración de un rol (None = pendiente)."""
    from scripts.seed_demo import DEMO_USERS

    _, email, password = DEMO_USERS[role]
    return email, password


@pytest.fixture
def patient_ids(db_session) -> dict[str, "uuid.UUID"]:
    """IDs de los afiliados de demostración: con consentimiento, sin él y revocado."""
    from sqlalchemy import select

    from app.models import Patient
    from scripts import seed_demo

    by_ci = {
        "consent": seed_demo.CI_WITH_CONSENT,
        "no_consent": seed_demo.CI_WITHOUT_CONSENT,
        "revoked": seed_demo.CI_REVOKED,
    }
    return {
        name: db_session.scalar(select(Patient.id).where(Patient.ci == ci))
        for name, ci in by_ci.items()
    }


@pytest.fixture
def auth_headers(client):
    """Devuelve una función clave de rol -> cabecera Authorization con un token válido."""
    cache: dict[str | None, dict[str, str]] = {}

    def headers_for(role: str | None = "admin") -> dict[str, str]:
        if role not in cache:
            email, password = demo_credentials(role)
            response = client.post(
                "/api/v1/auth/login", json={"email": email, "password": password}
            )
            assert response.status_code == 200, response.text
            cache[role] = {"Authorization": f"Bearer {response.json()['access_token']}"}
        return cache[role]

    return headers_for
