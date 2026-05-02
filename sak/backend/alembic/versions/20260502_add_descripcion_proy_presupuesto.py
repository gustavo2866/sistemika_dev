"""add descripcion to proy_presupuestos

Revision ID: 20260502_add_descripcion_proy_presupuesto
Revises: 20260502_add_herramientas_proy_presupuesto
Create Date: 2026-05-02

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = "20260502_add_descripcion_proy_presupuesto"
down_revision: Union[str, Sequence[str], None] = "20260502_add_herramientas_proy_presupuesto"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Upgrade schema."""
    op.add_column(
        "proy_presupuestos",
        sa.Column("descripcion", sa.String(500), nullable=True),
    )


def downgrade() -> None:
    """Downgrade schema."""
    op.drop_column("proy_presupuestos", "descripcion")
