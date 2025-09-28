from typing import Optional, List, TYPE_CHECKING

from sqlmodel import Field, Relationship

from .base import Base

if TYPE_CHECKING:
    from .factura import Factura

DEFAULT_PROPIEDADES = (
    (1, 'Casa Central', 'Departamento', 'Inversiones SA', 'activa'),
    (2, 'Depósito Norte', 'Galpón', 'Logística SRL', 'activa'),
    (3, 'Oficina Microcentro', 'Oficina', 'Inmobiliaria SA', 'mantenimiento'),
    (4, 'Local Comercial 45', 'Local', 'Retail Partners', 'alquilada'),
    (5, 'Terreno Ruta 9', 'Terreno', 'Desarrollos SRL', 'disponible'),
)


class Propiedad(Base, table=True):
    """Catálogo de propiedades sobre las que se pueden imputar facturas."""

    __tablename__ = 'propiedades'

    nombre: str = Field(max_length=255, unique=True, index=True)
    tipo: str = Field(max_length=100, description='Tipo de propiedad')
    propietario: str = Field(max_length=255, description='Propietario o responsable')
    estado: str = Field(max_length=100, description='Estado actual de la propiedad')

    facturas: List['Factura'] = Relationship(back_populates='propiedad')

    def __str__(self) -> str:  # pragma: no cover
        return f"Propiedad(id={self.id}, nombre='{self.nombre}')"
