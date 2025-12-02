"""add descripcion to crm_eventos

Revision ID: 023_add_descripcion_eventos
Revises: e318dce771be
Create Date: 2025-12-02

"""
from alembic import op
import sqlalchemy as sa

# revision identifiers, used by Alembic.
revision = '023_add_descripcion_eventos'
down_revision = 'e318dce771be'
branch_labels = None
depends_on = None


def upgrade():
    # Agregar columna descripcion a crm_eventos
    op.add_column('crm_eventos', sa.Column('descripcion', sa.Text(), nullable=True))


def downgrade():
    # Eliminar columna descripcion de crm_eventos
    op.drop_column('crm_eventos', 'descripcion')
