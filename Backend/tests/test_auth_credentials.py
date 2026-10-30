from datetime import UTC, datetime, timedelta

from sqlalchemy import select

from app.models import AuditLog, User
from app.modules.auth.schemas import LoginRequest
from tests.conftest import requires_db


def test_login_request_normaliza_el_correo():
    assert LoginRequest(email="  Dayana.Rojas@UCB.edu.bo ", password="x").email == (
        "dayana.rojas@ucb.edu.bo"
    )


@requires_db
class TestValidacionDeCredenciales:
    def login(self, client, email="jose.rodriguez.p@ucb.edu.bo", password="Admin123"):
        return client.post("/api/v1/auth/login", json={"email": email, "password": password})

    def test_correo_en_mayusculas_inicia_sesion(self, client):
        assert self.login(client, email="JOSE.RODRIGUEZ.P@UCB.EDU.BO").status_code == 200

    def test_contrasena_incorrecta_es_401_con_mensaje_generico(self, client):
        response = self.login(client, password="Admin1234")

        assert response.status_code == 401
        assert response.json() == {"detail": "Correo o contraseña incorrectos, o usuario inactivo."}

    def test_correo_inexistente_responde_igual_que_contrasena_incorrecta(self, client):
        response = self.login(client, email="nadie@ucb.edu.bo")

        assert response.status_code == 401
        assert response.json()["detail"] == self.login(client, password="mala").json()["detail"]

    def test_usuario_inactivo_no_puede_iniciar_sesion(self, client, db_session):
        db_session.get(User, "u-jose").active = False
        db_session.commit()

        assert self.login(client).status_code == 401

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

        assert response.status_code == 423
        assert "bloqueada" in response.json()["detail"]
        critical = db_session.scalar(
            select(AuditLog).where(
                AuditLog.actor == "jose.rodriguez.p@ucb.edu.bo", AuditLog.severity == "CRITICAL"
            )
        )
        assert critical is not None

    def test_bloqueo_vencido_permite_iniciar_sesion_y_reinicia_contador(self, client, db_session):
        user = db_session.get(User, "u-jose")
        user.locked_until = datetime.now(UTC) - timedelta(seconds=1)
        user.failed_login_attempts = 3
        db_session.commit()

        assert self.login(client).status_code == 200
        db_session.refresh(user)
        assert user.failed_login_attempts == 0
        assert user.locked_until is None
