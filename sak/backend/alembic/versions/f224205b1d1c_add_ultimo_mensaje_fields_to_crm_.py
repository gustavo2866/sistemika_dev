"""add_ultimo_mensaje_fields_to_crm_oportunidades

Revision ID: f224205b1d1c
Revises: 20260115_add_fecha_and_fecha_estado_to_po_ordenes_compra
Create Date: 2026-01-24 09:27:43.536616

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = 'f224205b1d1c'
down_revision: Union[str, Sequence[str], None] = '20260115_add_fecha_and_fecha_estado_to_po_ordenes_compra'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Upgrade schema."""
    # Add ultimo_mensaje_id and ultimo_mensaje_at fields to crm_oportunidades
    op.add_column('crm_oportunidades', sa.Column('ultimo_mensaje_id', sa.Integer(), nullable=True))
    op.add_column('crm_oportunidades', sa.Column('ultimo_mensaje_at', sa.DateTime(), nullable=True))
    
    # Add indexes for the new fields
    op.create_index('ix_crm_oportunidades_ultimo_mensaje_id', 'crm_oportunidades', ['ultimo_mensaje_id'])
    op.create_index('ix_crm_oportunidades_ultimo_mensaje_at', 'crm_oportunidades', ['ultimo_mensaje_at'])
    
    # Add foreign key constraint for ultimo_mensaje_id
    op.create_foreign_key(
        'fk_crm_oportunidades_ultimo_mensaje_id', 
        'crm_oportunidades', 
        'crm_mensajes', 
        ['ultimo_mensaje_id'], 
        ['id']
    )


def downgrade() -> None:
    """Downgrade schema."""
    # Drop foreign key constraint
    op.drop_constraint('fk_crm_oportunidades_ultimo_mensaje_id', 'crm_oportunidades', type_='foreignkey')
    
    # Drop indexes
    op.drop_index('ix_crm_oportunidades_ultimo_mensaje_at', table_name='crm_oportunidades')
    op.drop_index('ix_crm_oportunidades_ultimo_mensaje_id', table_name='crm_oportunidades')
    
    # Drop columns
    op.drop_column('crm_oportunidades', 'ultimo_mensaje_at')
    op.drop_column('crm_oportunidades', 'ultimo_mensaje_id')
