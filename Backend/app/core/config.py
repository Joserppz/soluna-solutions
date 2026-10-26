import os

from dotenv import load_dotenv

load_dotenv()

DATABASE_URL = os.environ["DATABASE_URL"]
JWT_SECRET_PLACEHOLDER = "reemplazar-por-un-secreto-aleatorio"  # noqa: S105 - valor de .env.example
JWT_SECRET = os.environ["JWT_SECRET"]
if len(JWT_SECRET) < 32 or JWT_SECRET == JWT_SECRET_PLACEHOLDER:
    raise RuntimeError(
        "JWT_SECRET debe ser un valor aleatorio de al menos 32 caracteres. Genera uno con: "
        'python -c "import secrets; print(secrets.token_urlsafe(32))"'
    )
SESSION_MAX_AGE_SECONDS = int(os.getenv("SESSION_MAX_AGE_SECONDS", "1800"))
SESSION_IDLE_LIMIT_SECONDS = int(os.getenv("SESSION_IDLE_LIMIT_SECONDS", "900"))
CORS_ORIGINS = [
    origin.strip()
    for origin in os.getenv("CORS_ORIGINS", "http://localhost:5173").split(",")
    if origin.strip()
]

# Supabase Storage para documentos privados de pacientes (opcional en desarrollo)
SUPABASE_URL = os.getenv("SUPABASE_URL", "").rstrip("/")
SUPABASE_SERVICE_ROLE_KEY = os.getenv("SUPABASE_SERVICE_ROLE_KEY", "")
PATIENT_DOCUMENTS_BUCKET = os.getenv("PATIENT_DOCUMENTS_BUCKET", "documentos-pacientes")
SIGNED_URL_SECONDS = int(os.getenv("SIGNED_URL_SECONDS", "300"))
