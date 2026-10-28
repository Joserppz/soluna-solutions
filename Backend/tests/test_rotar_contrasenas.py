"""Rotación de las contraseñas sembradas por la migración 001 (SCRUM-64 / SCRUM-104)."""

from app.models import AuditLog
from scripts.rotar_contrasenas_iniciales import (
    SEED_PASSWORDS,
    accounts_with_seed_password,
    rotate_seed_passwords,
)
from tests.conftest import requires_db


def login(client, email, password):
    return client.post("/api/v1/auth/login", json={"email": email, "password": password})


@requires_db
def test_todas_las_cuentas_sembradas_empiezan_con_su_contrasena_inicial(db_session):
    assert sorted(accounts_with_seed_password(db_session)) == sorted(SEED_PASSWORDS)


@requires_db
def test_rotar_invalida_la_contrasena_inicial_y_entrega_una_nueva(client, db_session):
    rotated = rotate_seed_passwords(db_session)

    assert sorted(rotated) == sorted(SEED_PASSWORDS)
    assert login(client, "dayana.rojas@ucb.edu.bo", "Admin123").status_code == 401
    nueva = login(client, "dayana.rojas@ucb.edu.bo", rotated["dayana.rojas@ucb.edu.bo"])
    assert nueva.status_code == 200
    assert len(set(rotated.values())) == len(rotated)


@requires_db
def test_rotar_cierra_sesiones_y_queda_en_la_bitacora(client, db_session, auth_headers):
    headers = auth_headers("Administrador")

    rotate_seed_passwords(db_session)

    assert client.get("/api/v1/auth/verify", headers=headers).status_code == 401

    eventos = db_session.query(AuditLog).filter_by(action="Rotación de contraseña inicial").all()
    assert len(eventos) == len(SEED_PASSWORDS)
    assert {e.actor_role for e in eventos} == {"Sistema"}


@requires_db
def test_ejecutarlo_de_nuevo_no_cambia_nada(db_session):
    rotate_seed_passwords(db_session)

    assert rotate_seed_passwords(db_session) == {}
    assert accounts_with_seed_password(db_session) == []
