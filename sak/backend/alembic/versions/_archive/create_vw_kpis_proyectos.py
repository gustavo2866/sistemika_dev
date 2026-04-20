"""crear vista kpis proyectos po orders

Revision ID: create_vw_kpis_proyectos
Revises: 
Create Date: 2024-03-25 16:00:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = 'create_vw_kpis_proyectos'
down_revision: Union[str, None] = 'c04054590260'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # Crear vista optimizada para KPIs Dashboard Proyectos
    op.execute("""
        CREATE OR REPLACE VIEW vw_kpis_proyectos_po_orders AS
        SELECT 
            o.id as nro_orden,
            o.tipo_solicitud_id,
            p.id as proyecto_id,
            o.oportunidad_id,
            log_emision.fecha_registro as fecha_emision,
            os.nombre as estado,
            -- Mapeo de tipo_solicitud a concepto de proyecto
            CASE 
                WHEN o.tipo_solicitud_id = 7 THEN 'mo_propia'
                WHEN o.tipo_solicitud_id IN (3, 5, 6) THEN 'mo_terceros'  -- Servicios, Transporte, Mensajería
                WHEN o.tipo_solicitud_id IN (1, 2, 4) THEN 'materiales'   -- Materiales, Ferretería, Insumos
                ELSE 'otros'
            END as concepto_proyecto,
            o.total as importe
        FROM po_orders o
        -- Join con log para obtener fecha de emisión (estado = 3 'emitida')
        INNER JOIN po_order_status_log log_emision 
            ON o.id = log_emision.order_id 
            AND log_emision.status_nuevo_id = 3  -- Estado 'emitida'
        -- Join para obtener estado actual
        INNER JOIN po_order_status os ON o.order_status_id = os.id
        -- Join con proyectos a través de oportunidad_id  
        INNER JOIN proyectos p ON o.oportunidad_id = p.oportunidad_id
        WHERE 
            o.oportunidad_id IS NOT NULL
            AND p.oportunidad_id IS NOT NULL
            AND log_emision.fecha_registro IS NOT NULL;
    """)
    
    # Crear índices recomendados para performance
    op.execute("""
        CREATE INDEX IF NOT EXISTS idx_vw_kpis_proyectos_fecha_emision 
        ON po_order_status_log (fecha_registro) 
        WHERE status_nuevo_id = 3;
    """)
    
    op.execute("""
        CREATE INDEX IF NOT EXISTS idx_vw_kpis_proyectos_oportunidad 
        ON po_orders (oportunidad_id) 
        WHERE oportunidad_id IS NOT NULL;
    """)


def downgrade() -> None:
    # Eliminar índices
    op.execute("DROP INDEX IF EXISTS idx_vw_kpis_proyectos_oportunidad;")
    op.execute("DROP INDEX IF EXISTS idx_vw_kpis_proyectos_fecha_emision;")
    
    # Eliminar vista
    op.execute("DROP VIEW IF EXISTS vw_kpis_proyectos_po_orders;")