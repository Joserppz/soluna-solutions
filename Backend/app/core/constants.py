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

# RNF-06: roles que pueden ver la anamnesis (además se exige consentimiento y acceso Activo)
CLINICAL_ROLES = ("Administrador", "Coordinador", "Profesional")

# Datos de admisión que cualquier rol editor puede registrar en la filiación
INTAKE_ANAMNESIS_COLUMNS = ("diagnosis", "stage", "neurologist_certificate")
# Notas y evaluaciones que solo registra el personal clínico
CLINICAL_ONLY_COLUMNS = (
    "symptom_notes",
    "physical_evaluation",
    "speech_evaluation",
    "psychological_evaluation",
    "medications",
)

DOCUMENT_TYPES = (
    "CI",
    "Certificado neurológico",
    "Evaluación clínica",
    "Consentimiento informado",
    "Otro",
)
DOCUMENT_CONTENT_TYPES = {
    "application/pdf": ".pdf",
    "image/jpeg": ".jpg",
    "image/png": ".png",
    "image/webp": ".webp",
}
DOCUMENT_MAX_BYTES = 10 * 1024 * 1024
