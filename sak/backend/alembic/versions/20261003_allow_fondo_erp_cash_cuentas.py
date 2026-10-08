"""allow Fondo tipo in erp cash cuentas

Revision ID: 20261003_allow_fondo_erp_cash_cuentas
Revises: 20261002_add_tipo_to_erp_cash_cuentas
Create Date: 2026-10-03
"""

from typing import Sequence, Union

from alembic import op


revision: str = "20261003_allow_fondo_erp_cash_cuentas"
down_revision: Union[str, Sequence[str], None] = "20261002_add_tipo_to_erp_cash_cuentas"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.drop_constraint("ck_erp_cash_cuentas_tipo_valid", "erp_cash_cuentas", type_="check")
    op.create_check_constraint(
        "ck_erp_cash_cuentas_tipo_valid",
        "erp_cash_cuentas",
        "tipo IS NULL OR tipo IN ('Ingreso', 'Egreso', 'Fondo')",
    )


def downgrade() -> None:
    op.execute("UPDATE erp_cash_cuentas SET tipo = NULL WHERE tipo = 'Fondo'")
    op.drop_constraint("ck_erp_cash_cuentas_tipo_valid", "erp_cash_cuentas", type_="check")
    op.create_check_constraint(
        "ck_erp_cash_cuentas_tipo_valid",
        "erp_cash_cuentas",
        "tipo IS NULL OR tipo IN ('Ingreso', 'Egreso')",
    )
