"""Add oportunidad_id FK to proyecto

Revision ID: 20260324_111329_add_oportunidad_id_fk_to_proyecto
Revises: 20260323_add_crm_dashboard_indexes
Create Date: 2026-03-24 11:13:29

"""
from typing import Sequence, Union
from alembic import op
import sqlalchemy as sa

# revision identifiers, used by Alembic.
revision: str = "20260324_111329_add_oportunidad_id_fk_to_proyecto"
down_revision: Union[str, Sequence[str], None] = "20260323_add_crm_dashboard_indexes"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # Add oportunidad_id column to proyectos table
    op.add_column('proyectos', sa.Column('oportunidad_id', sa.Integer(), nullable=True))
    
    # Add foreign key constraint
    op.create_foreign_key(
        'fk_proyectos_oportunidad_id', 
        'proyectos', 
        'crm_oportunidades', 
        ['oportunidad_id'], 
        ['id']
    )


def downgrade() -> None:
    # Remove foreign key constraint
    op.drop_constraint('fk_proyectos_oportunidad_id', 'proyectos', type_='foreignkey')
    
    # Remove column
    op.drop_column('proyectos', 'oportunidad_id')