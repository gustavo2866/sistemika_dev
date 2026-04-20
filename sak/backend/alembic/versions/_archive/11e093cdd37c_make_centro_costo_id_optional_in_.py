"""make_centro_costo_id_optional_in_solicitudes

Revision ID: 11e093cdd37c
Revises: 20260130_update_po_solicitudes_estados
Create Date: 2026-02-01 12:23:51.278480

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = '11e093cdd37c'
down_revision: Union[str, Sequence[str], None] = '20260130_update_po_solicitudes_estados'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Upgrade schema."""
    # Hacer la columna centro_costo_id nullable en la tabla po_solicitudes
    op.alter_column(
        'po_solicitudes',
        'centro_costo_id',
        existing_type=sa.Integer(),
        nullable=True,
        existing_nullable=False
    )


def downgrade() -> None:
    """Downgrade schema."""
    # Revertir: hacer la columna centro_costo_id NOT NULL
    # Nota: Solo se puede hacer si no hay valores NULL en la columna
    op.alter_column(
        'po_solicitudes',
        'centro_costo_id',
        existing_type=sa.Integer(),
        nullable=False,
        existing_nullable=True
    )
