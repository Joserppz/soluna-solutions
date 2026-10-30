"""DTOs compartidos por todos los módulos."""

from pydantic import BaseModel, ConfigDict
from pydantic.alias_generators import to_camel


class CamelModel(BaseModel):
    """Base de los DTOs: JSON en camelCase como Frontend/src/types/aspar.ts."""

    model_config = ConfigDict(alias_generator=to_camel, populate_by_name=True)


class MessageResponse(BaseModel):
    """Respuesta simple con un mensaje para el usuario."""

    message: str
