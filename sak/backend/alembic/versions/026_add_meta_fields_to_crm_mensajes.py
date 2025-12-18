"""026_add_meta_fields_to_crm_mensajes

Revision ID: 026_add_meta_fields
Revises: 025_create_crm_celulares
Create Date: 2025-12-18 00:00:01.000000

"""
from typing import Sequence, Union
from alembic import op
import sqlalchemy as sa

# revision identifiers, used by Alembic.
revision: str = '026_add_meta_fields'
down_revision: Union[str, Sequence[str], None] = '025_create_crm_celulares'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Add estado_meta and celular_id to crm_mensajes."""
    # Add estado_meta column
    op.add_column(
        'crm_mensajes',
        sa.Column('estado_meta', sa.String(length=50), nullable=True)
    )
    op.create_index(
        op.f('ix_crm_mensajes_estado_meta'),
        'crm_mensajes',
        ['estado_meta'],
        unique=False
    )
    
    # Add celular_id column
    op.add_column(
        'crm_mensajes',
        sa.Column('celular_id', sa.Integer(), nullable=True)
    )
    op.create_index(
        op.f('ix_crm_mensajes_celular_id'),
        'crm_mensajes',
        ['celular_id'],
        unique=False
    )
    op.create_foreign_key(
        'fk_crm_mensajes_celular_id',
        'crm_mensajes',
        'crm_celulares',
        ['celular_id'],
        ['id']
    )


def downgrade() -> None:
    """Remove estado_meta and celular_id from crm_mensajes."""
    # Drop celular_id
    op.drop_constraint('fk_crm_mensajes_celular_id', 'crm_mensajes', type_='foreignkey')
    op.drop_index(op.f('ix_crm_mensajes_celular_id'), table_name='crm_mensajes')
    op.drop_column('crm_mensajes', 'celular_id')
    
    # Drop estado_meta
    op.drop_index(op.f('ix_crm_mensajes_estado_meta'), table_name='crm_mensajes')
    op.drop_column('crm_mensajes', 'estado_meta')
