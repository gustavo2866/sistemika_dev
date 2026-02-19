"""Drop unique index on propiedades.nombre

Revision ID: 9635faa590ee
Revises: 6eb3d389ca94
Create Date: 2026-02-19 09:11:40.389140

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = '9635faa590ee'
down_revision: Union[str, Sequence[str], None] = '6eb3d389ca94'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Drop unique index on propiedades.nombre and create regular index."""
    
    # Drop the unique index
    op.drop_index('ix_propiedades_nombre', table_name='propiedades')
    
    # Create a regular (non-unique) index instead
    op.create_index('ix_propiedades_nombre', 'propiedades', ['nombre'], unique=False)


def downgrade() -> None:
    """Restore unique index on propiedades.nombre."""
    
    # Drop the regular index
    op.drop_index('ix_propiedades_nombre', table_name='propiedades')
    
    # Create the unique index back
    op.create_index('ix_propiedades_nombre', 'propiedades', ['nombre'], unique=True)
