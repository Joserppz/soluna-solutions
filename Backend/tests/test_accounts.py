"""Registro abierto, verificación de correo, recuperación y cambio de contraseña."""

import re
from datetime import UTC, datetime, timedelta

import pytest
from sqlalchemy import select

from app.models import User, UserSession
from app.modules.users.service import temporary_password
from tests.conftest import login, requires_db, session_headers

pytestmark = requires_db

NEW = {
    "name": "Rosa Mamani",
    "email": "Rosa.Mamani@gmail.com",
    "password": "Rosa2026x",
    "turnstileToken": "humano",
}
GENERIC = "Si los datos son correctos, te enviamos un correo con los pasos a seguir."


def register(client, **overrides):
    return client.post("/api/v1/auth/register", json=NEW | overrides)


def password_login(client, email="rosa.mamani@gmail.com", password="Rosa2026x"):
    return client.post("/api/v1/auth/login", json={"email": email, "password": password})


def user(db_session, email="rosa.mamani@gmail.com") -> User | None:
    return db_session.scalar(select(User).where(User.email == email))


class TestRegistro:
    def test_crea_cuenta_pendiente_y_envia_el_enlace(self, client, db_session, outbox, captcha):
        response = register(client)

        assert response.status_code == 202
        assert response.json() == {"message": GENERIC}
        account = user(db_session)
        assert account.role is None and account.email_verified is False
        assert outbox.sent[0].to == "rosa.mamani@gmail.com"
        assert "/verificar-correo?token=" in outbox.sent[0].text

    def test_no_ingresa_hasta_confirmar_el_correo(self, client, outbox, captcha):
        register(client)

        blocked = password_login(client)
        verified = client.post("/api/v1/auth/verify-email", json={"token": outbox.link()})
        allowed = password_login(client)

        assert blocked.status_code == 403
        assert "Confirma tu correo" in blocked.json()["detail"]
        assert verified.status_code == 200
        assert allowed.status_code == 200
        assert allowed.json()["user"]["roleName"] == "Pendiente de aprobación"

    def test_correo_ya_registrado_responde_igual_y_avisa_al_dueno(
        self, client, db_session, outbox, captcha
    ):
        response = register(client, email="admin@aspar.org")

        assert response.status_code == 202
        assert response.json() == {"message": GENERIC}
        assert outbox.sent[0].subject == "Ya tienes una cuenta en ASPAR"
        assert db_session.scalars(select(User).where(User.email == "admin@aspar.org")).all()

    def test_sin_turnstile_valido_no_se_registra(self, client, db_session, outbox, captcha):
        response = register(client, turnstileToken="robot")

        assert response.status_code == 400
        assert "persona" in response.json()["detail"]
        assert user(db_session) is None and outbox.sent == []

    @pytest.mark.parametrize(
        ("field", "value", "message"),
        [("password", "corta1", "8 caracteres"), ("email", "sin-arroba", "correo")],
    )
    def test_valida_contrasena_y_correo(self, client, outbox, captcha, field, value, message):
        response = register(client, **{field: value})

        assert response.status_code == 422
        assert message in response.json()["detail"]

    def test_enlace_de_verificacion_es_de_un_solo_uso(self, client, outbox, captcha):
        register(client)
        token = outbox.link()

        first = client.post("/api/v1/auth/verify-email", json={"token": token})
        second = client.post("/api/v1/auth/verify-email", json={"token": token})

        assert first.status_code == 200
        assert second.status_code == 422
        assert "no es válido" in second.json()["detail"]

    def test_reenviar_invalida_el_enlace_anterior(self, client, outbox, captcha):
        register(client)
        old = outbox.link()

        client.post(
            "/api/v1/auth/resend-verification",
            json={"email": "rosa.mamani@gmail.com", "turnstileToken": "humano"},
        )

        assert len(outbox.sent) == 2
        assert client.post("/api/v1/auth/verify-email", json={"token": old}).status_code == 422
        assert (
            client.post("/api/v1/auth/verify-email", json={"token": outbox.link()}).status_code
            == 200
        )

    def test_enlace_vencido_no_sirve(self, client, db_session, outbox, captcha):
        from app.modules.auth.models import AuthToken

        register(client)
        for token in db_session.scalars(select(AuthToken)):
            token.expires_at = datetime.now(UTC) - timedelta(seconds=1)
        db_session.commit()

        response = client.post("/api/v1/auth/verify-email", json={"token": outbox.link()})

        assert response.status_code == 422


class TestRecuperacion:
    def forgot(self, client, email):
        return client.post(
            "/api/v1/auth/forgot-password", json={"email": email, "turnstileToken": "humano"}
        )

    def test_correo_desconocido_responde_igual_sin_enviar_nada(self, client, outbox, captcha):
        response = self.forgot(client, "nadie@aspar.org")

        assert response.status_code == 202
        assert response.json() == {"message": GENERIC}
        assert outbox.sent == []

    def test_restablecer_cambia_la_contrasena_y_cierra_sesiones(
        self, client, db_session, outbox, captcha
    ):
        headers = session_headers(client, login(client, "volunteer"))
        self.forgot(client, "voluntario@aspar.org")
        token = outbox.link()

        response = client.post(
            "/api/v1/auth/reset-password", json={"token": token, "password": "Nueva2026x"}
        )

        assert response.status_code == 200
        assert client.get("/api/v1/auth/me", headers=headers).status_code == 401
        assert password_login(client, "voluntario@aspar.org", "Voluntario2026!").status_code == 401
        assert password_login(client, "voluntario@aspar.org", "Nueva2026x").status_code == 200
        again = client.post(
            "/api/v1/auth/reset-password", json={"token": token, "password": "Otra2026x"}
        )
        assert again.status_code == 422


class TestContrasenaTemporal:
    def invite(self, client, auth_headers):
        body = client.post(
            "/api/v1/users",
            json={"name": "Lic. Paola Vargas", "email": "paola@aspar.org", "role": "professional"},
            headers=auth_headers(),
        ).json()
        return body["temporaryPassword"]

    def test_formato_legible_y_distinta_cada_vez(self):
        passwords = {temporary_password() for _ in range(20)}

        assert len(passwords) == 20
        assert all(re.fullmatch(r"[A-Za-z]+-\d{4}-[A-Za-z]+", p) for p in passwords)

    def test_debe_cambiarse_antes_de_usar_el_panel(self, client, auth_headers, db_session):
        temporary = self.invite(client, auth_headers)
        response = password_login(client, "paola@aspar.org", temporary)
        headers = session_headers(client, response)

        assert response.json()["user"]["mustChangePassword"] is True
        blocked = client.get("/api/v1/patients", headers=headers)
        assert blocked.status_code == 403
        assert "Cambia tu contraseña temporal" in blocked.json()["detail"]

        changed = client.post(
            "/api/v1/auth/change-password",
            json={"currentPassword": temporary, "newPassword": "Paola2026x"},
            headers=headers,
        )

        assert changed.status_code == 200
        assert changed.json()["user"]["mustChangePassword"] is False
        assert client.get("/api/v1/patients", headers=headers).status_code == 200

    def test_contrasena_temporal_vencida_no_permite_ingresar(
        self, client, auth_headers, db_session
    ):
        temporary = self.invite(client, auth_headers)
        user(db_session, "paola@aspar.org").temp_password_expires_at = datetime.now(
            UTC
        ) - timedelta(minutes=1)
        db_session.commit()

        response = password_login(client, "paola@aspar.org", temporary)

        assert response.status_code == 401
        assert "venció" in response.json()["detail"]

    def test_cambio_propio_exige_la_actual_y_cierra_otras_sesiones(self, client, db_session):
        other = session_headers(client, login(client, "coordination"))
        current = session_headers(client, login(client, "coordination"))

        wrong = client.post(
            "/api/v1/auth/change-password",
            json={"currentPassword": "mala", "newPassword": "Coord2027x"},
            headers=current,
        )
        right = client.post(
            "/api/v1/auth/change-password",
            json={"currentPassword": "Coord2026!", "newPassword": "Coord2027x"},
            headers=current,
        )

        assert wrong.status_code == 422
        assert right.status_code == 200
        assert client.get("/api/v1/auth/me", headers=current).status_code == 200
        assert client.get("/api/v1/auth/me", headers=other).status_code == 401
        open_sessions = db_session.scalars(
            select(UserSession).where(
                UserSession.user_id == user(db_session, "coordinacion@aspar.org").id,
                UserSession.revoked_at.is_(None),
            )
        ).all()
        assert len(open_sessions) == 1


class TestGoogle:
    def claims(self, email, sub="google-1", verified=True, name="Rosa Mamani"):
        return {"sub": sub, "email": email, "email_verified": verified, "name": name}

    def google_login(self, client, credential="credencial-de-google"):
        return client.post("/api/v1/auth/google", json={"credential": credential})

    def test_cuenta_nueva_queda_pendiente_y_con_sesion(self, client, db_session, google):
        google.claims["credencial-de-google"] = self.claims("rosa@gmail.com")

        response = self.google_login(client)

        assert response.status_code == 200
        assert response.cookies["aspar_session"]
        body = response.json()["user"]
        assert body["roleName"] == "Pendiente de aprobación"
        assert body["googleLinked"] is True and body["hasPassword"] is False
        account = user(db_session, "rosa@gmail.com")
        assert account.password_hash is None and account.email_verified is True

    def test_google_con_correo_no_verificado_es_rechazado(self, client, google):
        google.claims["credencial-de-google"] = self.claims("rosa@gmail.com", verified=False)

        assert self.google_login(client).status_code == 403

    def test_vincula_una_cuenta_existente_con_correo_verificado(self, client, db_session, google):
        google.claims["credencial-de-google"] = self.claims("profesional@aspar.org", sub="g-9")

        response = self.google_login(client)

        assert response.status_code == 200
        assert response.json()["user"]["role"] == "professional"
        assert user(db_session, "profesional@aspar.org").google_sub == "g-9"

    def test_nunca_vincula_una_cuenta_con_correo_sin_confirmar(
        self, client, db_session, google, outbox, captcha
    ):
        # Alguien registró antes el correo de otra persona y nunca lo confirmó
        register(client, email="dueno.real@gmail.com")
        google.claims["credencial-de-google"] = self.claims("dueno.real@gmail.com", sub="g-real")

        response = self.google_login(client)

        assert response.status_code == 409
        assert user(db_session, "dueno.real@gmail.com").google_sub is None

    def test_credencial_invalida_es_401(self, client, google):
        assert self.google_login(client, "otra-credencial-falsa").status_code == 401

    def test_sin_client_id_responde_503(self, client):
        response = self.google_login(client)

        assert response.status_code == 503
        assert "Google" in response.json()["detail"]
