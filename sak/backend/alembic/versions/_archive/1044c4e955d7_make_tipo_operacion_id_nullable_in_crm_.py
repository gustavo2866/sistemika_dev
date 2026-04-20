"""Make tipo_operacion_id nullable in crm_oportunidades

Revision ID: 1044c4e955d7
Revises: fc7833bda751
Create Date: 2025-12-30 20:37:01.373848

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = '1044c4e955d7'
down_revision: Union[str, Sequence[str], None] = 'fc7833bda751'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Upgrade schema."""
    # Hacer nullable la columna tipo_operacion_id
    op.alter_column(
        'crm_oportunidades',
        'tipo_operacion_id',
        existing_type=sa.Integer(),
        nullable=True
    )


def downgrade() -> None:
    """Downgrade schema."""
    # Revertir: hacer NOT NULL nuevamente
    # Nota: Esto fallará si hay registros con NULL
    op.alter_column(
        'crm_oportunidades',
        'tipo_operacion_id',
        existing_type=sa.Integer(),
        nullable=False
    )
