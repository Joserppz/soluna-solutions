"""La especificación publicada en docs/api/openapi.json coincide con la API (SCRUM-154)."""

from scripts.export_openapi import OPENAPI_FILE, build_spec, render


def test_openapi_publicado_esta_actualizado():
    assert OPENAPI_FILE.exists(), "Falta docs/api/openapi.json: python -m scripts.export_openapi"
    assert OPENAPI_FILE.read_text(encoding="utf-8") == render(build_spec()), (
        "docs/api/openapi.json está desactualizado: ejecuta python -m scripts.export_openapi"
    )


def test_openapi_documenta_los_endpoints_del_sprint_1():
    paths = build_spec()["paths"]

    for path in (
        "/api/v1/auth/login",
        "/api/v1/auth/refresh",
        "/api/v1/auth/logout",
        "/api/v1/patients",
        "/api/v1/patients/{patient_id}",
        "/api/v1/users",
        "/api/v1/audit",
    ):
        assert path in paths, f"{path} no aparece en la especificación"
