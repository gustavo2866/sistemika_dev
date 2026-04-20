"""add_tax_profile_id_to_proveedores

Revision ID: 7545126e8317
Revises: 1ebdf3b06e7b
Create Date: 2026-02-12 08:42:29.279475

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = '7545126e8317'
down_revision: Union[str, Sequence[str], None] = '1ebdf3b06e7b'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Upgrade schema."""
    # Agregar columna tax_profile_id a proveedores
    op.add_column('proveedores', sa.Column('tax_profile_id', sa.Integer(), nullable=True))
    
    # Crear foreign key constraint
    op.create_foreign_key(
        'fk_proveedores_tax_profile_id',
        'proveedores',
        'tax_profiles',
        ['tax_profile_id'],
        ['id']
    )


def downgrade() -> None:
    """Downgrade schema."""
    # Eliminar foreign key constraint
    op.drop_constraint('fk_proveedores_tax_profile_id', 'proveedores', type_='foreignkey')
    
    # Eliminar columna
    op.drop_column('proveedores', 'tax_profile_id')
