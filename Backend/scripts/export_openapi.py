"""Exporta la especificación OpenAPI de la API a docs/api/openapi.json (SCRUM-128 / SCRUM-154).

Uso (desde la carpeta Backend, con el entorno virtual activo):

    python -m scripts.export_openapi            # regenera docs/api/openapi.json
    python -m scripts.export_openapi --check    # falla si el archivo está desactualizado

No se conecta a la base de datos: solo lee los routers y esquemas de la aplicación.
"""

import argparse
import json
import os
import sys
from pathlib import Path

OPENAPI_FILE = Path(__file__).resolve().parents[2] / "docs" / "api" / "openapi.json"


def build_spec() -> dict:
    # La configuración exige estas variables al importar la app; aquí no se usan
    os.environ.setdefault("DATABASE_URL", "postgresql://openapi:openapi@localhost:1/openapi")
    os.environ.setdefault("JWT_SECRET", "solo-para-exportar-openapi-sin-conexion-aspar")
    from app.main import app

    return app.openapi()


def render(spec: dict) -> str:
    return json.dumps(spec, ensure_ascii=False, indent=2, sort_keys=True) + "\n"


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__.splitlines()[0])
    parser.add_argument("--check", action="store_true", help="solo verifica que esté actualizado")
    args = parser.parse_args()

    content = render(build_spec())
    if args.check:
        current = OPENAPI_FILE.read_text(encoding="utf-8") if OPENAPI_FILE.exists() else ""
        if current != content:
            print(f"{OPENAPI_FILE} está desactualizado: ejecuta python -m scripts.export_openapi")
            return 1
        print(f"{OPENAPI_FILE} está actualizado")
        return 0

    OPENAPI_FILE.write_text(content, encoding="utf-8")
    print(f"OpenAPI exportado en {OPENAPI_FILE}")
    return 0


if __name__ == "__main__":
    sys.exit(main())
