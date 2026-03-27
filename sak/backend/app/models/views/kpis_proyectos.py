from datetime import date
from decimal import Decimal
from typing import Optional

from sqlmodel import SQLModel, Field


class VwKpisProyectosPoOrders(SQLModel, table=True):
    """Vista optimizada para KPIs Dashboard Proyectos - PO Orders con fecha de emisión"""

    __tablename__ = "vw_kpis_proyectos_po_orders"

    nro_orden: int = Field(primary_key=True)
    tipo_solicitud_id: int
    proyecto_id: int
    oportunidad_id: Optional[int]
    fecha_emision: date
    estado: str
    concepto_proyecto: str  # 'mo_propia', 'mo_terceros', 'materiales', 'otros'
    importe: Decimal