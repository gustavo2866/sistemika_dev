"""Add titulo to po_solicitudes simple

Revision ID: 7e815a521765
Revises: f306bf65751e
Create Date: 2026-01-08 04:37:46.817617

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = '7e815a521765'
down_revision: Union[str, Sequence[str], None] = '60278347d3ea'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Upgrade schema."""
    # Agregar la columna titulo como nullable primero
    op.add_column('po_solicitudes', sa.Column('titulo', sa.String(length=200), nullable=True))
    
    # Agregar valor por defecto a registros existentes
    op.execute("""
        UPDATE po_solicitudes 
        SET titulo = 'Solicitud #' || id 
        WHERE titulo IS NULL
    """)
    
    # Hacer la columna NOT NULL
    op.alter_column('po_solicitudes', 'titulo', nullable=False)


def downgrade() -> None:
    """Downgrade schema."""
    op.drop_column('po_solicitudes', 'titulo')
