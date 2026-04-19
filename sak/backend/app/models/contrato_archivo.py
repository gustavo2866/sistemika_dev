from typing import TYPE_CHECKING, ClassVar, List, Optional

from sqlmodel import Field, Relationship

from .base import Base

if TYPE_CHECKING:
    from .contrato import Contrato


class ContratoArchivo(Base, table=True):
    """Archivos adjuntos a un contrato (DNI, contrato firmado, recibos, etc.)."""

    __tablename__ = "contratos_archivos"
    __searchable_fields__: ClassVar[List[str]] = ["nombre", "tipo", "descripcion"]

    contrato_id: int = Field(foreign_key="contratos.id", index=True, description="Contrato al que pertenece el archivo")
    nombre: str = Field(max_length=300, description="Nombre descriptivo del archivo")
    descripcion: Optional[str] = Field(default=None, max_length=500, description="Descripcion o notas sobre el archivo")
    tipo: Optional[str] = Field(default=None, max_length=100, description="Tipo: contrato_firmado|dni|recibo_sueldo|garantia|otro")
    archivo_url: str = Field(max_length=500, description="Path relativo o URL del archivo almacenado")
    mime_type: Optional[str] = Field(default=None, max_length=100, description="Tipo MIME del archivo")
    tamanio_bytes: Optional[int] = Field(default=None, description="Tamaño del archivo en bytes")

    contrato: Optional["Contrato"] = Relationship(back_populates="archivos")
