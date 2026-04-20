"""Add responsable_id FK to proyecto

Revision ID: 20260324_112400_add_responsable_id_fk_to_proyecto
Revises: 20260324_111329_add_oportunidad_id_fk_to_proyecto
Create Date: 2026-03-24 11:24:00

"""
from typing import Sequence, Union
from alembic import op
import sqlalchemy as sa

# revision identifiers, used by Alembic.
revision: str = "20260324_112400_add_responsable_id_fk_to_proyecto"
down_revision: Union[str, Sequence[str], None] = "20260324_111329_add_oportunidad_id_fk_to_proyecto"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # Add responsable_id column to proyectos table
    op.add_column('proyectos', sa.Column('responsable_id', sa.Integer(), nullable=False, server_default='1'))
    
    # Add foreign key constraint
    op.create_foreign_key(
        'fk_proyectos_responsable_id', 
        'proyectos', 
        'users', 
        ['responsable_id'], 
        ['id']
    )
    
    # Remove temporary default
    op.alter_column('proyectos', 'responsable_id', server_default=None)


def downgrade() -> None:
    # Remove foreign key constraint
    op.drop_constraint('fk_proyectos_responsable_id', 'proyectos', type_='foreignkey')
    
    # Remove column
    op.drop_column('proyectos', 'responsable_id')