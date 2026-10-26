# Registro de Decisiones de Arquitectura (ADR) — ASPAR (SCRUM-64 / SCRUM-106)

Cada ADR documenta una decisión técnica: el contexto, la decisión, las alternativas descartadas y sus consecuencias. Las decisiones del Sprint 1 se registraron a partir de la implementación en `Sprint1` y deben ser revisadas por la arquitecta del proyecto antes de cerrarse.

| ADR | Decisión | Estado | Requisitos |
| :--- | :--- | :--- | :--- |
| [ADR-001](./ADR-001-api-fastapi-en-capas.md) | API FastAPI organizada en capas (routers → services → repositories) | Aceptada | RNF-11 |
| [ADR-002](./ADR-002-postgresql-supabase-y-migraciones-sql.md) | PostgreSQL en Supabase con migraciones SQL versionadas | Aceptada | RF-02, RNF-11 |
| [ADR-003](./ADR-003-jwt-con-sesiones-en-servidor.md) | JWT HS256 respaldado por sesiones en la base de datos | Aceptada | RF-01, RNF-02 |
| [ADR-004](./ADR-004-bcrypt-y-bloqueo-por-intentos.md) | Contraseñas con bcrypt (costo 12) y bloqueo tras 5 intentos | Aceptada | RF-01, RNF-02 |
| [ADR-005](./ADR-005-proteccion-rnf06-en-servidor.md) | Protección de datos clínicos aplicada en el servidor | Aceptada | RNF-06 |
| [ADR-006](./ADR-006-bitacora-inmutable.md) | Bitácora de auditoría inmutable y escrita solo por el Backend | Aceptada | RF-17 |
| [ADR-007](./ADR-007-supabase-solo-desde-el-backend.md) | Supabase accesible solo desde el Backend (RLS sin políticas) | Aceptada | RNF-06 |
| [ADR-008](./ADR-008-modo-local-de-respaldo-en-frontend.md) | Modo local de respaldo en el Frontend, solo si la API no responde | Aceptada (temporal) | RF-01, RF-02 |
| [ADR-009](./ADR-009-contrato-verificado-por-prueba.md) | Contrato Frontend ↔ Backend verificado por una prueba automática | Aceptada | RNF-11 |

**Formato:** cada archivo sigue la plantilla *Contexto → Decisión → Alternativas → Consecuencias → Evidencia*. Una decisión nueva o que reemplaza a otra se agrega como un ADR nuevo con el número siguiente; los ADR aceptados no se editan, se marcan como «Reemplazada por ADR-XXX».
