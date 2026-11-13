#!/usr/bin/env bash
# Publica la API de ASPAR en Google Cloud Run, con la base en Supabase.
# Se ejecuta en Cloud Shell (https://shell.cloud.google.com), desde la raíz del repositorio.
#
#   bash Backend/deploy/cloud_run.sh secretos   # guarda las claves en Secret Manager (no se ven al escribirlas)
#   bash Backend/deploy/cloud_run.sh migrar     # crea o actualiza las tablas en Supabase
#   bash Backend/deploy/cloud_run.sh api        # construye la imagen y despliega la API
#   bash Backend/deploy/cloud_run.sh admin      # crea la primera cuenta de Administración
#   bash Backend/deploy/cloud_run.sh estado     # dirección de la API, prueba de salud y qué poner en Cloudflare Pages
#
# Los valores que no son secretos van en Backend/deploy/cloud-run.env (copia de
# cloud-run.env.example; ese archivo no se sube a git). Guía completa:
# docs/despliegue/DESPLIEGUE_SIN_DOMINIO.md
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
CONFIG="${ASPAR_DEPLOY_CONFIG:-$ROOT/Backend/deploy/cloud-run.env}"
VENV="${ASPAR_VENV:-$HOME/.aspar-venv}"

fail() {
  echo "✗ $*" >&2
  exit 1
}

load_config() {
  [ -f "$CONFIG" ] || fail "Falta $CONFIG. Cópialo de cloud-run.env.example y complétalo."
  # shellcheck disable=SC1090
  set -a && . "$CONFIG" && set +a
  REGION="${REGION:-southamerica-east1}"
  SERVICE="${SERVICE:-aspar-api}"
  PROXY_TRUSTED_HOPS="${PROXY_TRUSTED_HOPS:-2}"
  EMAIL_PROVIDER="${EMAIL_PROVIDER:-brevo}"
  PROJECT="$(gcloud config get-value project 2>/dev/null)"
  [ -n "$PROJECT" ] || fail "Elige el proyecto: gcloud config set project <id-del-proyecto>"
  SA="$SERVICE@$PROJECT.iam.gserviceaccount.com"
  case "${FRONTEND_URL:-}" in
    https://*) FRONTEND_URL="${FRONTEND_URL%/}" ;;
    *) fail "FRONTEND_URL debe empezar con https:// (la dirección de Cloudflare Pages, …pages.dev)." ;;
  esac
  case "$EMAIL_PROVIDER" in
    brevo | resend) ;;
    *) fail "EMAIL_PROVIDER debe ser brevo o resend." ;;
  esac
}

secret_exists() {
  gcloud secrets describe "$1" >/dev/null 2>&1
}

# guardar <secreto> <valor> [cuenta que lo lee]
store_secret() {
  if secret_exists "$1"; then
    printf '%s' "$2" | gcloud secrets versions add "$1" --data-file=- >/dev/null
  else
    printf '%s' "$2" | gcloud secrets create "$1" --replication-policy=automatic --data-file=- >/dev/null
  fi
  if [ -n "${3:-}" ]; then
    gcloud secrets add-iam-policy-binding "$1" --member="serviceAccount:$3" \
      --role=roles/secretmanager.secretAccessor >/dev/null
  fi
  echo "  ✓ $1"
}

# preguntar <secreto> <descripción> <obligatorio: si|no> [cuenta que lo lee]
ask_secret() {
  local name="$1" label="$2" required="$3" reader="${4:-}" value=""
  if secret_exists "$name"; then
    read -rsp "  $label (Enter para dejar el que ya está): " value
  else
    read -rsp "  $label: " value
  fi
  echo
  if [ -z "$value" ]; then
    if secret_exists "$name"; then
      [ -n "$reader" ] && gcloud secrets add-iam-policy-binding "$name" \
        --member="serviceAccount:$reader" --role=roles/secretmanager.secretAccessor >/dev/null
      echo "  = $name sin cambios"
    elif [ "$required" = si ]; then
      fail "$label es obligatorio."
    else
      echo "  - $name omitido (opcional)"
    fi
    return
  fi
  store_secret "$name" "$value" "$reader"
}

cmd_secretos() {
  load_config
  echo "Activando los servicios de Google Cloud (la primera vez tarda un poco)…"
  gcloud services enable run.googleapis.com secretmanager.googleapis.com \
    cloudbuild.googleapis.com artifactregistry.googleapis.com >/dev/null
  if ! gcloud iam service-accounts describe "$SA" >/dev/null 2>&1; then
    gcloud iam service-accounts create "$SERVICE" --display-name="API de ASPAR" >/dev/null
    echo "  ✓ cuenta de servicio $SA"
  fi

  echo "Claves (se escriben sin mostrarse):"
  if secret_exists aspar-jwt-secret; then
    gcloud secrets add-iam-policy-binding aspar-jwt-secret --member="serviceAccount:$SA" \
      --role=roles/secretmanager.secretAccessor >/dev/null
    echo "  = aspar-jwt-secret ya existe"
  else
    store_secret aspar-jwt-secret "$(python3 -c 'import secrets; print(secrets.token_urlsafe(48))')" "$SA"
  fi
  ask_secret aspar-database-url "DATABASE_URL (Supabase, Transaction pooler, puerto 6543)" si "$SA"
  # Solo la usan «migrar» y «admin» desde Cloud Shell: la API no la puede leer
  ask_secret aspar-migration-database-url "MIGRATION_DATABASE_URL (Supabase, Session pooler, puerto 5432)" si
  ask_secret aspar-supabase-service-role "SUPABASE_SERVICE_ROLE_KEY (secret key de Supabase)" si "$SA"
  ask_secret aspar-email-api-key "API key de $EMAIL_PROVIDER" si "$SA"
  ask_secret aspar-turnstile-secret "Secret Key de Cloudflare Turnstile" si "$SA"
  ask_secret aspar-cloudinary-secret "API secret de Cloudinary (opcional, para la galería)" no "$SA"
  echo "Listo. Sigue con: bash Backend/deploy/cloud_run.sh migrar"
}

python_env() {
  if [ ! -x "$VENV/bin/python" ]; then
    echo "Preparando Python (solo la primera vez)…"
    python3 -m venv "$VENV"
  fi
  "$VENV/bin/pip" install -q --disable-pip-version-check -r "$ROOT/Backend/requirements.txt"
}

# Ejecuta un script de Backend/scripts contra la base de Supabase (usuario dueño del esquema)
run_on_database() {
  local url
  url="$(gcloud secrets versions access latest --secret=aspar-migration-database-url)" ||
    fail "Primero corre: bash Backend/deploy/cloud_run.sh secretos"
  python_env
  (
    cd "$ROOT/Backend"
    ENV=dev DB_POOL=null DATABASE_URL="$url" MIGRATION_DATABASE_URL="$url" \
      JWT_SECRET="$(python3 -c 'import secrets; print(secrets.token_urlsafe(48))')" \
      "$VENV/bin/python" -m "$@"
  )
}

cmd_migrar() {
  load_config
  run_on_database scripts.migrate
  run_on_database scripts.migrate --status
}

cmd_admin() {
  load_config
  run_on_database scripts.create_admin "$@"
}

# Una línea YAML con el valor entre comillas simples (las comillas internas se duplican)
yaml_line() {
  printf "%s: '%s'\n" "$1" "${2//\'/\'\'}"
}

cmd_api() {
  load_config
  local env_file secrets key_var
  env_file="$(mktemp)"
  # shellcheck disable=SC2064
  trap "rm -f '$env_file'" EXIT
  {
    yaml_line ENV prod
    yaml_line LOG_LEVEL INFO
    yaml_line DB_POOL null
    yaml_line PROXY_TRUSTED_HOPS "$PROXY_TRUSTED_HOPS"
    yaml_line COOKIE_SECURE true
    yaml_line COOKIE_DOMAIN ""
    yaml_line CORS_ORIGINS "$FRONTEND_URL"
    yaml_line FRONTEND_URL "$FRONTEND_URL"
    yaml_line EMAIL_PROVIDER "$EMAIL_PROVIDER"
    yaml_line EMAIL_FROM "${EMAIL_FROM:-ASPAR <asparlapaz@gmail.com>}"
    yaml_line GOOGLE_CLIENT_ID "${GOOGLE_CLIENT_ID:-}"
    yaml_line SUPABASE_URL "${SUPABASE_URL:?Falta SUPABASE_URL en cloud-run.env}"
    yaml_line CLOUDINARY_CLOUD_NAME "${CLOUDINARY_CLOUD_NAME:-}"
    yaml_line CLOUDINARY_API_KEY "${CLOUDINARY_API_KEY:-}"
  } >"$env_file"

  key_var="$(printf '%s' "$EMAIL_PROVIDER" | tr '[:lower:]' '[:upper:]')_API_KEY"
  secrets="JWT_SECRET=aspar-jwt-secret:latest,DATABASE_URL=aspar-database-url:latest"
  secrets+=",SUPABASE_SERVICE_ROLE_KEY=aspar-supabase-service-role:latest"
  secrets+=",$key_var=aspar-email-api-key:latest,TURNSTILE_SECRET_KEY=aspar-turnstile-secret:latest"
  if secret_exists aspar-cloudinary-secret; then
    secrets+=",CLOUDINARY_API_SECRET=aspar-cloudinary-secret:latest"
  fi

  echo "Construyendo y desplegando $SERVICE en $REGION (unos minutos)…"
  gcloud run deploy "$SERVICE" --source "$ROOT/Backend" --region="$REGION" \
    --service-account="$SA" --env-vars-file="$env_file" --set-secrets="$secrets" \
    --allow-unauthenticated --min-instances=0 --max-instances=3 --memory=512Mi --quiet
  cmd_estado
}

cmd_estado() {
  load_config
  local url
  url="$(gcloud run services describe "$SERVICE" --region="$REGION" --format='value(status.url)')"
  [ -n "$url" ] || fail "La API todavía no está desplegada: bash Backend/deploy/cloud_run.sh api"
  echo "API: $url"
  if curl -fsS "$url/api/v1/health" >/dev/null; then
    echo "  ✓ la API responde"
  else
    echo "  ✗ la API no responde: revisa el log en Cloud Run → $SERVICE → Registros"
  fi
  if curl -fsS "$url/api/v1/health/db" >/dev/null; then
    echo "  ✓ la API se conecta con Supabase"
  else
    echo "  ✗ la API no llega a la base: revisa aspar-database-url (Transaction pooler, puerto 6543)"
  fi
  cat <<EOF

En Cloudflare Pages → tu proyecto → Settings → Variables and Secrets (Production):
  API_ORIGIN = $url
Después: Deployments → … → Retry deployment, para que el sitio la use.
EOF
}

case "${1:-}" in
  secretos) cmd_secretos ;;
  migrar) cmd_migrar ;;
  api) cmd_api ;;
  admin) shift && cmd_admin "$@" ;;
  estado) cmd_estado ;;
  *)
    sed -n '2,13p' "$0"
    exit 1
    ;;
esac
