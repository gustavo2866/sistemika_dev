"""Update po_solicitudes estados: remove pendiente, add borrador and emitida

Revision ID: 20260130_update_po_solicitudes_estados
Revises: 20260125_add_default_articulos_to_proveedores
Create Date: 2026-01-30 12:00:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = '20260130_update_po_solicitudes_estados'
down_revision: Union[str, Sequence[str], None] = ('20260125_add_default_articulos_to_proveedores', 'bb6d8563b4bb')
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Upgrade schema."""
    # 1. Actualizar registros existentes que tengan estado 'pendiente' a 'borrador'
    op.execute("UPDATE po_solicitudes SET estado = 'borrador' WHERE estado = 'pendiente'")
    
    # 2. Cambiar el default de la columna estado de 'pendiente' a 'borrador'
    op.alter_column('po_solicitudes', 'estado',
                    existing_type=sa.String(length=20),
                    server_default='borrador',
                    nullable=False)


def downgrade() -> None:
    """Downgrade schema."""
    # 1. Cambiar registros de vuelta a 'pendiente'
    op.execute("UPDATE po_solicitudes SET estado = 'pendiente' WHERE estado = 'borrador'")
    
    # 2. Restaurar el default anterior
    op.alter_column('po_solicitudes', 'estado',
                    existing_type=sa.String(length=20),
                    server_default='pendiente',
                    nullable=False)