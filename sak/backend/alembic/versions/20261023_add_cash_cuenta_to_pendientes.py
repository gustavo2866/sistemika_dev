"""add optional cash account to pending cash input

Revision ID: 20261023_add_cash_cuenta_to_pendientes
Revises: 20261023_rename_cash_pend_input
Create Date: 2026-10-23
"""

from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op


revision: str = "20261023_add_cash_cuenta_to_pendientes"
down_revision: Union[str, Sequence[str], None] = "20261023_rename_cash_pend_input"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column(
        "erp_cash_pendientes_input",
        sa.Column("cuenta_cash_id", sa.Integer(), nullable=True),
    )
    op.create_foreign_key(
        "fk_erp_cash_pendientes_input_cuenta_cash_id",
        "erp_cash_pendientes_input",
        "erp_cash_cuentas",
        ["cuenta_cash_id"],
        ["id"],
    )
    op.create_index(
        "ix_erp_cash_pendientes_input_cuenta_cash_id",
        "erp_cash_pendientes_input",
        ["cuenta_cash_id"],
    )


def downgrade() -> None:
    op.drop_index(
        "ix_erp_cash_pendientes_input_cuenta_cash_id",
        table_name="erp_cash_pendientes_input",
    )
    op.drop_constraint(
        "fk_erp_cash_pendientes_input_cuenta_cash_id",
        "erp_cash_pendientes_input",
        type_="foreignkey",
    )
    op.drop_column("erp_cash_pendientes_input", "cuenta_cash_id")
