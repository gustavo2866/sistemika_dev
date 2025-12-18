"""025_create_crm_celulares

Revision ID: 025_create_crm_celulares
Revises: 024_add_fecha_estado_eventos
Create Date: 2025-12-18 00:00:00.000000

"""
from typing import Sequence, Union
from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

# revision identifiers, used by Alembic.
revision: str = '025_create_crm_celulares'
down_revision: Union[str, Sequence[str], None] = '024_add_fecha_estado_eventos'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Create crm_celulares table."""
    op.create_table(
        'crm_celulares',
        sa.Column('id', sa.Integer(), nullable=False, autoincrement=True),
        sa.Column('created_at', sa.DateTime(timezone=True), nullable=False, server_default=sa.text('now()')),
        sa.Column('updated_at', sa.DateTime(timezone=True), nullable=False, server_default=sa.text('now()')),
        sa.Column('deleted_at', sa.DateTime(timezone=True), nullable=True),
        sa.Column('version', sa.Integer(), nullable=False, server_default='1'),
        sa.Column('meta_celular_id', sa.String(length=255), nullable=False),
        sa.Column('numero_celular', sa.String(length=50), nullable=False),
        sa.Column('alias', sa.String(length=255), nullable=True),
        sa.Column('activo', sa.Boolean(), nullable=False, server_default='true'),
        sa.PrimaryKeyConstraint('id'),
        sa.UniqueConstraint('meta_celular_id')
    )
    
    # Create indexes
    op.create_index(op.f('ix_crm_celulares_meta_celular_id'), 'crm_celulares', ['meta_celular_id'], unique=False)
    op.create_index(op.f('ix_crm_celulares_numero_celular'), 'crm_celulares', ['numero_celular'], unique=False)
    op.create_index(op.f('ix_crm_celulares_deleted_at'), 'crm_celulares', ['deleted_at'], unique=False)


def downgrade() -> None:
    """Drop crm_celulares table."""
    op.drop_index(op.f('ix_crm_celulares_deleted_at'), table_name='crm_celulares')
    op.drop_index(op.f('ix_crm_celulares_numero_celular'), table_name='crm_celulares')
    op.drop_index(op.f('ix_crm_celulares_meta_celular_id'), table_name='crm_celulares')
    op.drop_table('crm_celulares')
