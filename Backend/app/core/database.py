"""Conexión a PostgreSQL y unidad de trabajo por petición.

Cada petición usa una sola sesión. Servicios y repositorios solo hacen ``flush()``; el
``commit()`` o ``rollback()`` ocurre una vez, al final, en ``get_db``. Así un cambio y su
registro en la bitácora se guardan juntos o no se guarda ninguno.
"""

import logging
from collections.abc import Callable, Iterator
from typing import Annotated

from fastapi import Depends
from sqlalchemy import Engine, create_engine
from sqlalchemy.orm import DeclarativeBase, Session, sessionmaker
from sqlalchemy.pool import NullPool

from app.core.config import settings
from app.core.errors import DomainError

logger = logging.getLogger("aspar.database")


def sqlalchemy_url(url: str) -> str:
    # SQLAlchemy 2.1 usa "psycopg" (v3) por defecto; forzamos psycopg2 (requirements.txt)
    if url.startswith("postgresql://"):
        return url.replace("postgresql://", "postgresql+psycopg2://", 1)
    if url.startswith("postgres://"):
        return url.replace("postgres://", "postgresql+psycopg2://", 1)
    return url


def build_engine(url: str) -> Engine:
    if settings.db_pool == "null":
        # Transaction Pooler de Supabase: el pooler ya reutiliza las conexiones
        return create_engine(sqlalchemy_url(url), poolclass=NullPool, pool_pre_ping=True)
    return create_engine(
        sqlalchemy_url(url),
        pool_pre_ping=True,
        pool_size=settings.db_pool_size,
        max_overflow=settings.db_max_overflow,
        pool_recycle=settings.db_pool_recycle_seconds,
    )


engine = build_engine(settings.database_url)
SessionLocal = sessionmaker(bind=engine, autoflush=False)


class Base(DeclarativeBase):
    pass


# ---------------------------------------------------------------------------
# Acciones ligadas al resultado de la transacción (por ejemplo, archivos en Storage)
# ---------------------------------------------------------------------------
AFTER_COMMIT = "after_commit"
ON_ROLLBACK = "on_rollback"


def after_commit(db: Session, action: Callable[[], None]) -> None:
    """Ejecuta ``action`` solo si la transacción se confirma (p. ej. borrar un archivo)."""
    db.info.setdefault(AFTER_COMMIT, []).append(action)


def on_rollback(db: Session, action: Callable[[], None]) -> None:
    """Ejecuta ``action`` si la transacción se revierte (p. ej. deshacer una subida)."""
    db.info.setdefault(ON_ROLLBACK, []).append(action)


def _run(db: Session, key: str) -> None:
    actions = db.info.pop(key, [])
    db.info.pop(AFTER_COMMIT if key == ON_ROLLBACK else ON_ROLLBACK, None)
    for action in actions:
        try:
            action()
        except Exception:
            # La transacción ya terminó: solo queda registrar la falla para revisarla
            logger.exception("Falló una acción posterior a la transacción (%s)", key)


def _commit(db: Session) -> None:
    try:
        db.commit()
    except Exception:
        _rollback(db)
        raise
    _run(db, AFTER_COMMIT)


def _rollback(db: Session) -> None:
    db.rollback()
    _run(db, ON_ROLLBACK)


def unit_of_work(db: Session) -> Iterator[Session]:
    """Confirma al terminar bien la petición y revierte si hubo un error."""
    try:
        yield db
    except DomainError as exc:
        if exc.persist:
            _commit(db)
        else:
            _rollback(db)
        raise
    except BaseException:
        _rollback(db)
        raise
    else:
        _commit(db)


def get_db() -> Iterator[Session]:
    db = SessionLocal()
    try:
        yield from unit_of_work(db)
    finally:
        db.close()


# scope="function": el commit ocurre ANTES de enviar la respuesta. Si falla, el cliente
# recibe el error (409, 503...) y no un 200 con datos que no se guardaron.
DbSession = Annotated[Session, Depends(get_db, scope="function")]
