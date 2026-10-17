"""allow pend type in erp cash proyectado

Revision ID: 20261019_allow_pend_erp_cash_proyectado
Revises: 20261018_create_metodo_proyeccion_cuenta
Create Date: 2026-10-19
"""

from typing import Sequence, Union

from alembic import op


revision: str = "20261019_allow_pend_erp_cash_proyectado"
down_revision: Union[str, Sequence[str], None] = (
    "20261018_create_metodo_proyeccion_cuenta"
)
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.drop_constraint(
        "ck_erp_cash_proyectado_tipo_valid",
        "erp_cash_proyectado",
        type_="check",
    )
    op.create_check_constraint(
        "ck_erp_cash_proyectado_tipo_valid",
        "erp_cash_proyectado",
        "tipo IN ('PROYECCION', 'PRESUPUESTO', 'pend', 'COMPROMETIDO', 'AJUSTE')",
    )


def downgrade() -> None:
    op.execute("DELETE FROM erp_cash_proyectado WHERE tipo = 'pend'")
    op.drop_constraint(
        "ck_erp_cash_proyectado_tipo_valid",
        "erp_cash_proyectado",
        type_="check",
    )
    op.create_check_constraint(
        "ck_erp_cash_proyectado_tipo_valid",
        "erp_cash_proyectado",
        "tipo IN ('PROYECCION', 'PRESUPUESTO', 'COMPROMETIDO', 'AJUSTE')",
    )
