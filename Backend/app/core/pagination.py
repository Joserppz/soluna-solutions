"""Paginación estándar de los listados: ``?limit=&offset=`` y respuesta
``{items, total, limit, offset}``. Así ningún listado devuelve la tabla completa."""

from collections.abc import Callable
from dataclasses import dataclass
from typing import Annotated, Any, Self

from fastapi import Depends, Query
from pydantic import Field
from sqlalchemy import Select, func, select
from sqlalchemy.orm import Session

from app.core.schemas import CamelModel

DEFAULT_LIMIT = 50
MAX_LIMIT = 200


@dataclass(frozen=True)
class PageParams:
    limit: int = DEFAULT_LIMIT
    offset: int = 0


def page_params(
    limit: int = Query(default=DEFAULT_LIMIT, ge=1, le=MAX_LIMIT),
    offset: int = Query(default=0, ge=0),
) -> PageParams:
    return PageParams(limit=limit, offset=offset)


Pagination = Annotated[PageParams, Depends(page_params)]


@dataclass
class PageResult[T]:
    items: list[T]
    total: int
    limit: int
    offset: int


def paginate(db: Session, query: Select, page: PageParams) -> PageResult:
    """Ejecuta ``query`` para una página. La consulta debe tener un orden total (con el
    id al final) para que dos páginas nunca repitan ni salten filas."""
    total = db.scalar(select(func.count()).select_from(query.order_by(None).subquery()))
    items = list(db.scalars(query.limit(page.limit).offset(page.offset)))
    return PageResult(items=items, total=total or 0, limit=page.limit, offset=page.offset)


class Page[T](CamelModel):
    items: list[T]
    total: int = Field(description="Filas que cumplen los filtros (todas las páginas)")
    limit: int
    offset: int

    @classmethod
    def of(cls, result: PageResult, convert: Callable[[Any], T]) -> Self:
        return cls(
            items=[convert(item) for item in result.items],
            total=result.total,
            limit=result.limit,
            offset=result.offset,
        )
