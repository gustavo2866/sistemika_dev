"""update_vacancia_fields_data

Revision ID: 062a1eaf2e0d
Revises: a47c8a439706
Create Date: 2026-02-21 16:46:21.140627

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = '062a1eaf2e0d'
down_revision: Union[str, Sequence[str], None] = 'a47c8a439706'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Update existing data for vacancia fields based on current property status."""
    
    # Update vacancia_activa = true for properties with status orden 1, 2, 3 (Recibida, En Reparación, Disponible)
    op.execute("""
        UPDATE propiedades 
        SET vacancia_activa = true 
        WHERE propiedad_status_id IN (
            SELECT id FROM propiedades_status WHERE orden IN (1, 2, 3)
        )
    """)
    
    # Update vacancia_fecha with the most recent status change date from the log for vacant properties
    op.execute("""
        UPDATE propiedades 
        SET vacancia_fecha = (
            SELECT pls.fecha_cambio::date
            FROM propiedades_log_status pls
            WHERE pls.propiedad_id = propiedades.id
              AND pls.estado_nuevo_id IN (
                  SELECT id FROM propiedades_status WHERE orden IN (1, 2, 3)
              )
            ORDER BY pls.fecha_cambio DESC
            LIMIT 1
        )
        WHERE vacancia_activa = true
          AND EXISTS (
              SELECT 1 FROM propiedades_log_status pls2 
              WHERE pls2.propiedad_id = propiedades.id
          )
    """)
    
    # For properties without log entries but with vacant status, use estado_fecha
    op.execute("""
        UPDATE propiedades 
        SET vacancia_fecha = estado_fecha
        WHERE vacancia_activa = true 
          AND vacancia_fecha IS NULL
          AND propiedad_status_id IN (
              SELECT id FROM propiedades_status WHERE orden IN (1, 2, 3)
          )
    """)


def downgrade() -> None:
    """Reset vacancia fields to default values."""
    op.execute("UPDATE propiedades SET vacancia_activa = false, vacancia_fecha = NULL")
