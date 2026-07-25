"""add erp_cuenta_tipo_id to erp_cuentas table

Revision ID: 20260722_add_erp_cuenta_tipo_id_to_erp_cuentas
Revises: 20260722_create_erp_cuenta_tipos
Create Date: 2026-07-22
"""

from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


revision: str = "20260722_add_erp_cuenta_tipo_id_to_erp_cuentas"
down_revision: Union[str, Sequence[str], None] = "20260722_create_erp_cuenta_tipos"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column(
        "erp_cuentas",
        sa.Column("erp_cuenta_tipo_id", sa.Integer(), nullable=True),
    )
    op.create_index("ix_erp_cuentas_erp_cuenta_tipo_id", "erp_cuentas", ["erp_cuenta_tipo_id"])
    op.create_foreign_key(
        "fk_erp_cuentas_erp_cuenta_tipo_id",
        "erp_cuentas",
        "erp_cuenta_tipos",
        ["erp_cuenta_tipo_id"],
        ["id"],
    )


def downgrade() -> None:
    op.drop_constraint("fk_erp_cuentas_erp_cuenta_tipo_id", "erp_cuentas", type_="foreignkey")
    op.drop_index("ix_erp_cuentas_erp_cuenta_tipo_id", table_name="erp_cuentas")
    op.drop_column("erp_cuentas", "erp_cuenta_tipo_id")
