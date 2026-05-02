"""add herramientas to proy_presupuestos

Revision ID: 20260502_add_herramientas_proy_presupuesto
Revises: 20260425_home_poorders_indexes
Create Date: 2026-05-02

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = "20260502_add_herramientas_proy_presupuesto"
down_revision: Union[str, Sequence[str], None] = "20260425_home_poorders_indexes"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Upgrade schema."""
    op.add_column(
        "proy_presupuestos",
        sa.Column(
            "herramientas",
            sa.DECIMAL(precision=14, scale=2),
            server_default="0",
            nullable=False,
        ),
    )


def downgrade() -> None:
    """Downgrade schema."""
    op.drop_column("proy_presupuestos", "herramientas")
