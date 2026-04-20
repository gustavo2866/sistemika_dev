"""remove_estado_field_from_propiedades

Revision ID: 267b3a8cae5b
Revises: 8591e8a24586
Create Date: 2026-02-19 19:34:08.350210

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = '267b3a8cae5b'
down_revision: Union[str, Sequence[str], None] = '8591e8a24586'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Remove the 'estado' field from propiedades table."""
    # Drop the 'estado' column from propiedades table
    op.drop_column('propiedades', 'estado')


def downgrade() -> None:
    """Restore the 'estado' field to propiedades table."""
    # Re-add the 'estado' column to propiedades table
    # Note: This assumes the field was VARCHAR and NOT NULL
    # You may need to adjust the type and constraints based on your specific needs
    op.add_column('propiedades', sa.Column('estado', sa.String(), nullable=False, server_default='1-disponible'))
