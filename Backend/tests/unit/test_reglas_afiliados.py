"""Reglas de las fichas de afiliados (RF-02) y de la privacidad clínica (RNF-06), sin base
de datos."""

import datetime as dt
from unittest.mock import patch

import pytest

from app.core.errors import Conflict, Forbidden, ValidationError
from app.modules.patients import service
from app.modules.patients.models import Patient
from app.modules.patients.schemas import ClinicalAnamnesis, ContactIn, PatientIn
from tests.unit.dobles import HOY, sesion, usuario

SERVICIO = "app.modules.patients.service"
CLINICO = ("patients:read_clinical", "patients:write_clinical")


def ficha(**cambios) -> PatientIn:
    datos = {
        "name": "Fausto Rojas Calle",
        "ci": "5208773",
        "phone": "77712345",
        "consent": True,
        "access_status": "Activo",
        "contacts": [ContactIn(name="Ana Rojas", relation="Nieta", phone="70011223")],
    }
    return PatientIn(**(datos | cambios))


class TestVerHistoriaClinica:
    """RNF-06: permiso clínico Y consentimiento firmado Y acceso Activo."""

    @pytest.mark.parametrize(
        ("permisos", "consentimiento", "acceso", "ve"),
        [
            (CLINICO, True, "Activo", True),
            (CLINICO, False, "Activo", False),
            (CLINICO, True, "Pendiente", False),
            (CLINICO, True, "Revocado", False),
            (("patients:read",), True, "Activo", False),
        ],
    )
    def test_tabla_de_verdad(self, permisos, consentimiento, acceso, ve):
        afiliado = Patient(consent=consentimiento, access_status=acceso)
        assert service.can_view_clinical_record(usuario(*permisos), afiliado) is ve


class TestValidaciones:
    def test_no_se_activa_el_acceso_clinico_sin_consentimiento(self):
        with pytest.raises(ValidationError, match="sin consentimiento"):
            service.validate_fields(
                name="Fausto Rojas",
                ci="5208773",
                phone="77712345",
                consent=False,
                access_status="Activo",
                stage="Estadio I (Leve unilateral)",
            )

    @pytest.mark.parametrize(
        ("campo", "valor", "mensaje"),
        [
            ("ci", "12AB", "Cédula"),
            ("phone", "70-12", "teléfono"),
            ("name", "Al", "nombre completo"),
        ],
    )
    def test_formato_de_carnet_telefono_y_nombre(self, campo, valor, mensaje):
        datos = {
            "name": "Fausto Rojas",
            "ci": "5208773",
            "phone": "77712345",
            "consent": True,
            "access_status": "Activo",
            "stage": "Estadio I (Leve unilateral)",
        }
        with pytest.raises(ValidationError, match=mensaje):
            service.validate_fields(**(datos | {campo: valor}))

    def test_siempre_hay_exactamente_un_familiar_principal(self):
        contactos = service.new_contacts(
            [
                ContactIn(name="Ana Rojas", relation="Nieta", phone="70011223"),
                ContactIn(name="Luis Rojas", relation="Hijo", phone="70011224", is_primary=True),
            ]
        )
        assert [c.is_primary for c in contactos] == [False, True]


class TestRegistrar:
    @pytest.fixture
    def dependencias(self):
        with (
            patch(f"{SERVICIO}.patient_repository") as repositorio,
            patch(f"{SERVICIO}.audit_service") as registro,
            patch("app.core.clock.today", return_value=HOY),
        ):
            repositorio.get_by_ci.return_value = None
            repositorio.add.side_effect = lambda db, afiliado: afiliado
            yield repositorio, registro

    def test_registra_con_la_fecha_de_firma_de_hoy_y_deja_constancia(self, dependencias):
        repositorio, registro = dependencias
        actual = usuario("patients:write", rol="Recepción")

        afiliado = service.create_patient(sesion(), ficha(name="  Fausto Rojas Calle "), actual)

        assert afiliado.name == "Fausto Rojas Calle"
        assert afiliado.consent_date == HOY
        assert afiliado.created_by == actual.user.id
        assert len(afiliado.contacts) == 1 and afiliado.contacts[0].is_primary
        repositorio.add.assert_called_once()
        assert registro.audit.call_args.kwargs["action"] == (
            "Registro de ficha y anamnesis de afiliado"
        )

    def test_un_carnet_repetido_no_crea_otra_ficha(self, dependencias):
        repositorio, registro = dependencias
        repositorio.get_by_ci.return_value = Patient(ci="5208773")

        with pytest.raises(Conflict, match="Cédula de Identidad"):
            service.create_patient(sesion(), ficha(), usuario("patients:write"))

        repositorio.add.assert_not_called()
        registro.audit.assert_not_called()

    def test_recepcion_no_carga_medicacion_y_el_intento_queda_registrado(self, dependencias):
        repositorio, registro = dependencias
        datos = ficha(anamnesis=ClinicalAnamnesis(medications="Levodopa 250 mg"))

        with pytest.raises(Forbidden):
            service.create_patient(sesion(), datos, usuario("patients:write", rol="Recepción"))

        repositorio.add.assert_not_called()
        assert registro.audit.call_args.kwargs["severity"] == "WARNING"

    def test_sin_consentimiento_no_hay_fecha_de_firma(self, dependencias):
        afiliado = service.create_patient(
            sesion(),
            ficha(consent=False, access_status="Pendiente", consent_date=dt.date(2026, 1, 1)),
            usuario("patients:write"),
        )
        assert afiliado.consent_date is None
