# ADR-005: Protección de datos clínicos aplicada en el servidor

- **Estado:** Aceptada
- **Fecha:** 2026-10-26
- **Requisitos:** RNF-06

## Contexto

En la primera versión, la anamnesis solo se ocultaba en la pantalla (`canViewClinicalRecord`), pero `GET /patients` la enviaba completa a cualquier rol, incluido el Voluntario, aunque el paciente no tuviera consentimiento.

## Decisión

- La API **no envía** la anamnesis clínica salvo que se cumplan las tres condiciones: rol clínico (`Administrador`, `Coordinador`, `Profesional`), consentimiento firmado y acceso `Activo` (`patient_service.can_view_clinical_record`).
- Solo los roles clínicos registran evaluaciones y medicación (`CLINICAL_ONLY_COLUMNS`); Recepción registra datos de admisión.
- La base impide un acceso `Activo` sin consentimiento (`CHECK`).
- Los documentos de pacientes van a un **bucket privado** de Supabase Storage y se entregan con **URLs firmadas de 300 s** (`adapters/storage.py`).
- Cada consulta de anamnesis queda en la bitácora.

## Alternativas descartadas

- **Mantener la protección solo en el Frontend:** cualquier persona con un token podía leer los datos con la API.
- **Cifrar las columnas clínicas:** útil a futuro, pero no reemplaza el control de acceso.

## Consecuencias

- ✅ La regla se cumple aunque alguien use la API sin la interfaz (verificado en el recorrido integrado, paso 6).
- ⚠️ La pantalla de pacientes muestra los campos clínicos a Recepción y el servidor los rechaza (403). Pendiente de ajuste en el Frontend.

## Evidencia

`Backend/app/modules/patients/service.py`, `Backend/app/modules/users/models.py` (roles clínicos), `Backend/tests/test_patient_privacy.py`.
