from typing import Optional
from sqlmodel import Field

from .base import Base


class Comprobante(Base, table=True):
    """Entidad de staging mínima para comprobantes extraídos.

    Solo guarda metadatos del archivo y el JSON crudo del extractor.
    """

    __tablename__ = "comprobantes"

    # Metadatos del archivo
    archivo_nombre: Optional[str] = Field(default=None, max_length=500)
    archivo_guardado: str = Field(max_length=500)
    archivo_ruta: str = Field(max_length=1000)
    file_type: Optional[str] = Field(default=None, max_length=50)
    is_pdf: bool = Field(default=True)

    # JSON crudo del extractor
    raw_json: Optional[str] = Field(default=None, description="JSON crudo devuelto por el extractor")

