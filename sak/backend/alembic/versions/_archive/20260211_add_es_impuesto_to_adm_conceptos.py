"""add es_impuesto field to adm_conceptos

Revision ID: 20260211_add_es_impuesto_to_adm_conceptos
Revises: 20260211_add_proveedor_tipo_comprobante_dias
Create Date: 2026-02-11 01:00:00.000000

"""
from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision = "20260211_add_es_impuesto_to_adm_conceptos"
down_revision = "20260211_add_proveedor_tipo_comprobante_dias"
branch_labels = None
depends_on = None


def upgrade() -> None:
    """Add es_impuesto field to adm_conceptos table."""
    
    # Add es_impuesto column with default value False
    op.add_column('adm_conceptos', sa.Column('es_impuesto', sa.Boolean(), nullable=False, server_default=sa.text('false')))


def downgrade() -> None:
    """Remove es_impuesto field from adm_conceptos table."""
    
    # Drop column
    op.drop_column('adm_conceptos', 'es_impuesto')