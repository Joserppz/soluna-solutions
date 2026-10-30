from datetime import UTC, datetime, timedelta

from sqlalchemy import select

from app.models import AuditLog, User
from app.modules.auth.schemas import LoginRequest
from tests.conftest import requires_db

EMAIL, PASSWORD = "coordinacion@aspar.org", "Coord2026!"
GENERIC = (
    "Correo o contraseña incorrectos. Tras 5 intentos fallidos el acceso se bloquea 15 minutos."
)


def test_login_request_normaliza_el_correo():
    assert LoginRequest(email="  Coordinacion@ASPAR.org ", password="x").email == (
        "coordinacion@aspar.org"
    )


def user(db_session) -> User:
    return db_session.scalar(select(User).where(User.email == EMAIL))


@requires_db
class TestValidacionDeCredenciales:
    def login(self, client, email=EMAIL, password=PASSWORD):
        return client.post("/api/v1/auth/login", json={"email": email, "password": password})

    def test_correo_en_mayusculas_inicia_sesion(self, client):
        assert self.login(client, email="COORDINACION@ASPAR.ORG").status_code == 200

    def test_contrasena_incorrecta_es_401_con_mensaje_generico(self, client):
        response = self.login(client, password="Coord2027!")

        assert response.status_code == 401
        assert response.json() == {"detail": GENERIC}

    def test_correo_inexistente_responde_igual_que_contrasena_incorrecta(self, client):
        response = self.login(client, email="nadie@aspar.org")

        assert response.status_code == 401
        assert response.json()["detail"] == self.login(client, password="mala").json()["detail"]

    def test_usuario_inactivo_no_puede_iniciar_sesion(self, client, db_session):
        user(db_session).active = False
        db_session.commit()

        response = self.login(client)

        assert response.status_code == 401
        assert response.json() == {"detail": GENERIC}

    def test_formato_de_correo_invalido_es_422_con_mensaje_en_texto(self, client):
        response = self.login(client, email="no-es-correo")

        assert response.status_code == 422
        assert isinstance(response.json()["detail"], str)
        assert "correo" in response.json()["detail"]

    def test_campos_faltantes_es_422(self, client):
        response = client.post("/api/v1/auth/login", json={"email": "a@b.co"})

        assert response.status_code == 422
        assert response.json()["detail"] == "El campo contraseña es obligatorio."

    def test_cinco_intentos_fallidos_bloquean_la_cuenta(self, client, db_session):
        for _ in range(5):
            assert self.login(client, password="incorrecta").status_code == 401

        response = self.login(client)

        # S6: la cuenta bloqueada responde igual que una contraseña incorrecta
        assert response.status_code == 401
        assert response.json() == {"detail": GENERIC}
        critical = db_session.scalar(
            select(AuditLog).where(AuditLog.actor == EMAIL, AuditLog.severity == "CRITICAL")
        )
        assert critical.action == "Cuenta bloqueada por intentos fallidos"

    def test_bloqueo_vencido_permite_iniciar_sesion_y_reinicia_contador(self, client, db_session):
        account = user(db_session)
        account.locked_until = datetime.now(UTC) - timedelta(seconds=1)
        account.failed_login_attempts = 3
        db_session.commit()

        assert self.login(client).status_code == 200
        db_session.refresh(account)
        assert account.failed_login_attempts == 0
        assert account.locked_until is None

    def test_cuenta_solo_de_google_no_inicia_sesion_con_contrasena(self, client, db_session):
        account = user(db_session)
        account.google_sub = "google-123"
        account.password_hash = None
        db_session.commit()

        assert self.login(client).status_code == 401
