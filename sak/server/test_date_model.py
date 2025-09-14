from typing import Optional
from datetime import datetime, date
from decimal import Decimal
from enum import Enum
from pydantic import BaseModel, Field
from sqlmodel import SQLModel

# Enum para estado de factura
class EstadoFactura(str, Enum):
    PENDIENTE = "pendiente"
    PROCESADA = "procesada" 
    PAGADA = "pagada"
    ANULADA = "anulada"

# Modelo Pydantic para crear facturas (entrada)
class FacturaCreate(BaseModel):
    numero: str = Field(max_length=50, description="Número de factura")
    punto_venta: str = Field(max_length=10, description="Punto de venta")
    tipo_comprobante: str = Field(max_length=20, description="Tipo de comprobante")
    fecha_emision: date = Field(description="Fecha de emisión")
    fecha_vencimiento: Optional[date] = Field(default=None, description="Fecha de vencimiento")
    subtotal: float = Field(description="Subtotal sin impuestos")
    total_impuestos: float = Field(description="Total de impuestos")
    total: float = Field(description="Total general")
    estado: EstadoFactura = Field(default=EstadoFactura.PENDIENTE, description="Estado de la factura")
    observaciones: Optional[str] = Field(default=None, description="Observaciones")
    proveedor_id: int = Field(description="ID del proveedor")
    tipo_operacion_id: int = Field(description="ID del tipo de operación")

# Modelo Pydantic para respuesta (salida)
class FacturaResponse(BaseModel):
    id: int
    numero: str
    punto_venta: str
    tipo_comprobante: str
    fecha_emision: date
    fecha_vencimiento: Optional[date]
    fecha_recepcion: datetime
    subtotal: float
    total_impuestos: float
    total: float
    estado: EstadoFactura
    observaciones: Optional[str]
    proveedor_id: int
    tipo_operacion_id: int

if __name__ == "__main__":
    # Probar el modelo con datos JSON
    import json
    
    test_data = {
        "numero": "0001-00000001",
        "punto_venta": "0001",
        "tipo_comprobante": "A",
        "fecha_emision": "2025-09-13",  # String ISO
        "subtotal": 1000.0,
        "total_impuestos": 210.0,
        "total": 1210.0,
        "proveedor_id": 1,
        "tipo_operacion_id": 1,
        "observaciones": "Factura de prueba"
    }
    
    try:
        factura = FacturaCreate(**test_data)
        print("✅ Modelo Pydantic funciona correctamente")
        print(f"📅 Fecha parseada: {factura.fecha_emision} (tipo: {type(factura.fecha_emision)})")
        print(f"📋 JSON de salida: {factura.model_dump_json()}")
    except Exception as e:
        print(f"❌ Error en modelo Pydantic: {e}")
