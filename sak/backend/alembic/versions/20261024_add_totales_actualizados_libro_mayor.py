"""add updated totals to erp libro mayor

Revision ID: 20261024_lm_totales_act
Revises: 20261024_erp_cuenta_tipos
Create Date: 2026-10-24
"""

from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


revision: str = "20261024_lm_totales_act"
down_revision: Union[str, Sequence[str], None] = "20261024_erp_cuenta_tipos"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column(
        "erp_libro_mayor",
        sa.Column("total_debe_actualizado", sa.Numeric(18, 6), nullable=True),
    )
    op.add_column(
        "erp_libro_mayor",
        sa.Column("total_haber_actualizado", sa.Numeric(18, 6), nullable=True),
    )


def downgrade() -> None:
    op.drop_column("erp_libro_mayor", "total_haber_actualizado")
    op.drop_column("erp_libro_mayor", "total_debe_actualizado")

