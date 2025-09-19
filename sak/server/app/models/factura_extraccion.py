from typing import Optional
from sqlmodel import SQLModel, Field
from .base import Base


class FacturaExtraccion(Base, table=True):
    """Histórico de extracciones de facturas (payload crudo + metadatos)"""
    __tablename__ = "facturas_extracciones"

    # Enlace a la factura (puede ser null si aún no se creó la factura)
    factura_id: Optional[int] = Field(default=None, foreign_key="facturas.id")

    # Archivo
    archivo_nombre: Optional[str] = Field(default=None, max_length=500, description="Nombre original del archivo subido")
    archivo_guardado: Optional[str] = Field(default=None, max_length=500, description="Nombre de archivo guardado (safe)")
    archivo_ruta: Optional[str] = Field(default=None, max_length=1000, description="Ruta completa del archivo guardado")
    file_type: Optional[str] = Field(default=None, max_length=20, description="Tipo de archivo detectado (pdf|image)")

    # Extracción
    metodo_extraccion: Optional[str] = Field(default=None, max_length=50)
    extractor_version: Optional[str] = Field(default=None, max_length=50)
    estado: str = Field(default="exitoso", max_length=30, description="Estado de la extracción (exitoso|error)")
    proveedor_id: Optional[int] = Field(default=None, description="Proveedor relacionado si se conoce")
    tipo_operacion_id: Optional[int] = Field(default=None, description="Tipo de operación si se conoce")
    is_pdf: bool = Field(default=True, description="Indica si el archivo original es PDF")

    # Datos crudos
    payload_json: Optional[str] = Field(default=None, description="JSON crudo de la extracción en texto")
    warnings: Optional[str] = Field(default=None, description="Advertencias de la extracción")
    error: Optional[str] = Field(default=None, description="Mensaje de error si falló")
