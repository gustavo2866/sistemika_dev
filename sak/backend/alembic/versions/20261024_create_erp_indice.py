"""create erp indice

Revision ID: 20261024_erp_indice
Revises: 20261023_add_cash_cuenta_to_pendientes
Create Date: 2026-10-24
"""

from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


revision: str = "20261024_erp_indice"
down_revision: Union[str, Sequence[str], None] = (
    "20261023_add_cash_cuenta_to_pendientes"
)
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table(
        "erp_indice",
        sa.Column("id", sa.Integer(), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("deleted_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column(
            "version",
            sa.Integer(),
            nullable=False,
            server_default=sa.text("1"),
        ),
        sa.Column("codigo", sa.String(length=3), nullable=False),
        sa.Column("fecha", sa.Date(), nullable=False),
        sa.Column("valor", sa.DECIMAL(precision=18, scale=6), nullable=False),
        sa.CheckConstraint(
            "codigo IN ('ICC', 'IPC', 'DOL')",
            name="ck_erp_indice_codigo_valid",
        ),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index("ix_erp_indice_codigo", "erp_indice", ["codigo"])
    op.create_index("ix_erp_indice_fecha", "erp_indice", ["fecha"])


def downgrade() -> None:
    op.drop_index("ix_erp_indice_fecha", table_name="erp_indice")
    op.drop_index("ix_erp_indice_codigo", table_name="erp_indice")
    op.drop_table("erp_indice")
