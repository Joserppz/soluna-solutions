"""scripts.create_admin y scripts.seed_demo: cuentas fuera del código y de las migraciones."""

import pytest
from sqlalchemy import select

from app.core.config import settings
from app.models import AuditLog, User
from scripts import create_admin, seed_demo
from tests.conftest import requires_db

pytestmark = requires_db


def test_crea_la_cuenta_de_administracion_con_correo_verificado(db_session):
    user = create_admin.create_admin(
        db_session, name="ASPAR Oficial", email="  Contacto.ASPAR@gmail.com ", password="Aspar2026x"
    )

    assert user.email == "contacto.aspar@gmail.com"
    assert user.role_key == "admin"
    assert user.email_verified is True
    assert user.password_hash.startswith("$2b$12$")
    assert db_session.scalar(
        select(AuditLog).where(AuditLog.action == "Alta de Administración por consola")
    )


@pytest.mark.parametrize(
    ("email", "password", "message"),
    [
        ("no-es-correo", "Aspar2026x", "correo"),
        ("admin@aspar.org", "Aspar2026x", "Ya existe"),
        ("nuevo@aspar.org", "corta1", "8 caracteres"),
    ],
)
def test_valida_correo_duplicados_y_contrasena(db_session, email, password, message):
    with pytest.raises(create_admin.AdminError, match=message):
        create_admin.create_admin(db_session, name="ASPAR", email=email, password=password)


@pytest.fixture
def consola(db_session, monkeypatch):
    """Ejecuta ``create_admin.main()`` como desde la terminal, sobre la sesión de prueba."""
    monkeypatch.setattr(create_admin, "SessionLocal", lambda: db_session)

    def run(*args: str, passwords: tuple[str, str] = ("Aspar2026x", "Aspar2026x")) -> int:
        answers = iter(passwords)
        monkeypatch.setattr(create_admin.getpass, "getpass", lambda _prompt: next(answers))
        monkeypatch.setattr("sys.argv", ["create_admin", *args])
        return create_admin.main()

    return run


def test_desde_la_consola_crea_la_cuenta_y_lo_confirma(consola, capsys):
    assert consola("--email", "Direccion@aspar.org", "--name", "Dirección ASPAR") == 0
    assert "Listo: direccion@aspar.org tiene el rol de Administración" in capsys.readouterr().out


def test_desde_la_consola_las_contrasenas_deben_coincidir(consola, capsys):
    code = consola(
        "--email", "otra@aspar.org", "--name", "Otra", passwords=("Aspar2026x", "Otra2026x")
    )

    assert code == 1
    assert "no coinciden" in capsys.readouterr().err


def test_promueve_una_cuenta_existente(db_session):
    user = create_admin.promote(db_session, "pendiente@aspar.org")

    assert user.role_key == "admin"
    with pytest.raises(create_admin.AdminError, match="No existe"):
        create_admin.promote(db_session, "nadie@aspar.org")


def test_seed_demo_es_idempotente(db_session):
    assert seed_demo.seed(db_session) == []
    assert db_session.scalar(select(User).where(User.email == "admin@aspar.org"))


def test_seed_demo_esta_bloqueado_en_produccion(db_session, monkeypatch):
    monkeypatch.setattr(settings, "env", "prod")

    with pytest.raises(seed_demo.SeedBlockedError, match="producción"):
        seed_demo.seed(db_session)
