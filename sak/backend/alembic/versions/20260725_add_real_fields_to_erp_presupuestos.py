"""add real ingreso/egreso fields to erp_presupuestos

Revision ID: 20260725_add_real_fields_to_erp_presupuestos
Revises: 1bf6df58d4eb
Create Date: 2026-07-25
"""

from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


revision: str = "20260725_add_real_fields_to_erp_presupuestos"
down_revision: Union[str, Sequence[str], None] = "1bf6df58d4eb"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column(
        "erp_presupuestos",
        sa.Column("real_egreso", sa.DECIMAL(precision=14, scale=2), nullable=False, server_default="0"),
    )
    op.add_column(
        "erp_presupuestos",
        sa.Column("real_ingreso", sa.DECIMAL(precision=14, scale=2), nullable=False, server_default="0"),
    )


def downgrade() -> None:
    op.drop_column("erp_presupuestos", "real_ingreso")
    op.drop_column("erp_presupuestos", "real_egreso")
