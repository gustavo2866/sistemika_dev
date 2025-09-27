from typing import Optional, TYPE_CHECKING
from sqlmodel import Field, Relationship

from .base import Base

if TYPE_CHECKING:
    from .factura import Factura


class Comprobante(Base, table=True):
    """Entidad de staging minima para comprobantes extraidos.

    Solo guarda metadatos del archivo y el JSON crudo del extractor.
    """

    __tablename__ = "comprobantes"

    archivo_nombre: Optional[str] = Field(default=None, max_length=500)
    archivo_guardado: str = Field(max_length=500)
    archivo_ruta: str = Field(max_length=1000)
    file_type: Optional[str] = Field(default=None, max_length=50)
    is_pdf: bool = Field(default=True)

    extraido_por_ocr: bool = Field(default=False, description="Si los datos fueron extraidos por OCR")
    extraido_por_llm: bool = Field(default=False, description="Si los datos fueron procesados por LLM")
    confianza_extraccion: Optional[float] = Field(
        default=None,
        description="Nivel de confianza de la extraccion (0-1)",
    )

    metodo_extraccion: Optional[str] = Field(default=None, max_length=50, description="Metodo utilizado para la extraccion")
    extractor_version: Optional[str] = Field(default=None, max_length=50, description="Version del extractor utilizado")
    estado: str = Field(default="pendiente", max_length=30, description="Estado del procesamiento del comprobante")
    proveedor_id: Optional[int] = Field(default=None, description="Proveedor identificado durante la extraccion")
    tipo_operacion_id: Optional[int] = Field(default=None, description="Tipo de operacion identificado durante la extraccion")
    warnings: Optional[str] = Field(default=None, description="Advertencias generadas durante la extraccion")
    error: Optional[str] = Field(default=None, description="Error producido durante la extraccion")

    raw_json: Optional[str] = Field(default=None, description="JSON crudo devuelto por el extractor")

    factura: Optional["Factura"] = Relationship(
        back_populates="comprobante",
        sa_relationship_kwargs={"uselist": False},
    )
