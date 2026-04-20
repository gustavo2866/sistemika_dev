
"""
Remove CRMOrigenLead entity and its references.

Revision ID: 20251219_remove_crm_origen_lead
Revises: 0b5792d2b455
Create Date: 2025-12-19 00:00:00.000000
"""
from typing import Sequence, Union
from alembic import op
import sqlalchemy as sa

# revision identifiers, used by Alembic.
revision: str = '20251219_remove_crm_origen_lead'
down_revision: Union[str, Sequence[str], None] = '0b5792d2b455'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None

def upgrade():
    # Drop foreign key and column from crm_eventos
    with op.batch_alter_table('crm_eventos') as batch_op:
        batch_op.drop_constraint('crm_eventos_origen_lead_id_fkey', type_='foreignkey')
        batch_op.drop_column('origen_lead_id')

    # Drop foreign key and column from crm_contactos
    with op.batch_alter_table('crm_contactos') as batch_op:
        batch_op.drop_constraint('crm_contactos_origen_lead_id_fkey', type_='foreignkey')
        batch_op.drop_column('origen_lead_id')

    # Drop crm_origenes_lead table
    op.drop_table('crm_origenes_lead')

def downgrade():
    # Recreate crm_origenes_lead table
    op.create_table(
        'crm_origenes_lead',
        sa.Column('id', sa.Integer, primary_key=True),
        sa.Column('codigo', sa.String(length=50), unique=True, index=True),
        sa.Column('nombre', sa.String(length=150)),
        sa.Column('descripcion', sa.String(length=500)),
        sa.Column('activo', sa.Boolean, default=True),
    )
    # Add column and foreign key back to crm_contactos
    with op.batch_alter_table('crm_contactos') as batch_op:
        batch_op.add_column(sa.Column('origen_lead_id', sa.Integer, sa.ForeignKey('crm_origenes_lead.id')))
