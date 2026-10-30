# ADR-011: Backend organizado por módulos de dominio

- **Estado:** Aceptada
- **Fecha:** 2026-10-30
- **Reemplaza a:** [ADR-001](./ADR-001-api-fastapi-en-capas.md)
- **Requisitos:** RNF-11 (estándares de código), diagrama C3

## Contexto

ADR-001 organizó el Backend por capas técnicas (`routers/`, `services/`, `repositories/`, `models/`, `schemas/`). Con 5 dominios funcionaba, pero el Sprint 2 suma 7 más (cronograma, asistencia, inventario, donaciones, contenido, galería y solicitudes): cada carpeta por capa terminaría con 12 archivos, y un cambio en un dominio obligaría a tocar 5 carpetas distintas.

## Decisión

Cada dominio vive en su propia carpeta con la misma plantilla de cinco archivos. Las capas del C3 se mantienen, pero dentro de cada módulo:

```
Backend/app/
├── main.py                 # crea la app, registra middlewares, errores y routers
├── models.py               # registro de todos los modelos ORM
├── core/                   # compartido: config, database (unidad de trabajo), errors,
│                           # logging, network (IP real), security, schemas (CamelModel)
├── adapters/storage.py     # servicios externos
└── modules/
    └── <dominio>/
        ├── router.py       # endpoints HTTP y permisos (capa Routers del C3)
        ├── service.py      # reglas de negocio y bitácora (capa Services)
        ├── repository.py   # consultas SQLAlchemy (capa Repositories)
        ├── schemas.py      # DTOs Pydantic de entrada y salida
        └── models.py       # tabla ORM y valores de dominio (estados, tipos)
```

Módulos actuales: `auth` (además `dependencies.py` con `get_current_user` y `require_roles`), `users`, `patients`, `documents` y `audit`.

**Reglas:**

- Un módulo usa a otro solo a través de su `service` o `repository` (por ejemplo, `documents` usa `patients.service.get_patient`); nunca de su `router`.
- `core/` no importa nada de `modules/`.
- Los servicios no conocen HTTP: lanzan errores de dominio de `core/errors.py` y no hacen `commit()` (la unidad de trabajo de `core/database.py` confirma una vez por petición).

## Alternativas descartadas

- **Seguir por capas (ADR-001):** con 12 dominios, cada carpeta mezcla temas sin relación y cuesta encontrar todo lo de un dominio.
- **Un paquete instalable por dominio:** aislamiento total, pero excesivo para un equipo de tres personas y un solo despliegue.

## Consecuencias

- ✅ Todo lo de un dominio está junto; un módulo nuevo se crea copiando la plantilla.
- ✅ Las dependencias entre dominios quedan explícitas en los `import`.
- ⚠️ Los documentos que citaban rutas como `app/services/...` se actualizaron a `app/modules/<dominio>/...`; los informes del Sprint 1 conservan las rutas de su fecha.

## Evidencia

`Backend/app/modules/`, `Backend/app/main.py`, `Backend/tests/` (las mismas pruebas pasan sin cambios de comportamiento).
