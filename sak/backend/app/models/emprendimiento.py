from datetime import date
from typing import Optional, TYPE_CHECKING

from sqlmodel import Field, Relationship

from .base import Base
from .enums import EstadoEmprendimiento

if TYPE_CHECKING:
    from .crm_oportunidad import CRMOportunidad
    from .propiedad import Propiedad
    from .user import User


class Emprendimiento(Base, table=True):
    __tablename__ = "emprendimientos"
    __searchable_fields__ = ["nombre", "descripcion", "ubicacion"]
    __expanded_list_relations__ = {"responsable"}

    nombre: str = Field(max_length=255, unique=True, index=True)
    descripcion: Optional[str] = Field(default=None, max_length=2000)
    ubicacion: Optional[str] = Field(default=None, max_length=500)
    estado: str = Field(
        default=EstadoEmprendimiento.PLANIFICACION.value,
        max_length=50,
        description="Estado del proyecto",
    )
    fecha_inicio: Optional[date] = Field(default=None)
    fecha_fin_estimada: Optional[date] = Field(default=None)
    responsable_id: int = Field(foreign_key="users.id")
    activo: bool = Field(default=True)

    responsable: Optional["User"] = Relationship()
    oportunidades: list["CRMOportunidad"] = Relationship(back_populates="emprendimiento")

    def __str__(self) -> str:  # pragma: no cover
        return f"Emprendimiento(id={self.id}, nombre='{self.nombre}')"
