"""Valores de dominio compartidos con Frontend/src/types/aspar.ts y la migración 001."""

ROLES = ("Administrador", "Coordinador", "Profesional", "Recepción", "Voluntario")

AUDIT_CATEGORIES = (
    "AUTENTICACION",
    "PACIENTES",
    "CONSENTIMIENTO",
    "USUARIOS_ROLES",
    "INVENTARIO",
    "CRONOGRAMA",
    "DONACIONES",
    "SISTEMA",
)
AUDIT_SEVERITIES = ("INFO", "WARNING", "CRITICAL")

ACCESS_STATUSES = ("Activo", "Pendiente", "Revocado")

PARKINSON_STAGES = (
    "Estadio I (Leve unilateral)",
    "Estadio II (Bilateral sin alteración del equilibrio)",
    "Estadio III (Moderado con inestabilidad postural)",
    "Estadio IV (Incapacidad grave pero camina con ayuda)",
    "Estadio V (Dependencia completa)",
    "Otro trastorno del movimiento",
)

# Roles que pueden registrar y editar fichas de pacientes
PATIENT_EDITOR_ROLES = ("Administrador", "Coordinador", "Profesional", "Recepción")
