# syntax=docker/dockerfile:1
# Imagen de la API ASPAR.
#   - Etapa "dev": la usa docker-compose.yml (recarga automática y herramientas de prueba).
#   - Etapa "runtime" (por defecto): la que se despliega en Google Cloud Run.

FROM python:3.12-slim AS base

ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1 \
    PIP_NO_CACHE_DIR=1 \
    PIP_DISABLE_PIP_VERSION_CHECK=1

WORKDIR /app

# Usuario sin privilegios: la API nunca corre como root
RUN groupadd --system aspar \
    && useradd --system --gid aspar --home-dir /app --shell /usr/sbin/nologin aspar

COPY requirements.txt .
RUN pip install -r requirements.txt


FROM base AS dev

COPY requirements-dev.txt .
RUN pip install -r requirements-dev.txt

# El código llega montado desde tu PC: los cachés de las herramientas van a /tmp para no
# necesitar permisos de escritura sobre la carpeta montada.
ENV COVERAGE_FILE=/tmp/.coverage \
    RUFF_CACHE_DIR=/tmp/.ruff_cache

USER aspar
EXPOSE 8000
# docker-compose.yml monta el repositorio en /repo y trabaja en /repo/Backend; se aplican
# las migraciones pendientes y se arranca con recarga automática.
CMD ["sh", "-c", "python -m scripts.migrate && exec uvicorn app.main:app --host 0.0.0.0 --port 8000 --reload --no-access-log"]


FROM base AS runtime

# Código de solo lectura para el usuario aspar (propiedad de root)
COPY app ./app
COPY migrations ./migrations
COPY scripts ./scripts

USER aspar

# Cloud Run indica el puerto en $PORT (8080 por defecto). La IP real del cliente la
# lee la propia API (PROXY_TRUSTED_HOPS), por eso no se usa --proxy-headers.
ENV PORT=8080
EXPOSE 8080
CMD ["sh", "-c", "exec uvicorn app.main:app --host 0.0.0.0 --port \"${PORT}\" --workers \"${WEB_CONCURRENCY:-1}\" --no-access-log"]
