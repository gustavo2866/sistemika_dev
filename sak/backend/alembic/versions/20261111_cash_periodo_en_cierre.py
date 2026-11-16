"""Permitir periodos Cash en cierre con saldos reales provisionales.

Revision ID: 20261111_cash_en_cierre
Revises: 20261024_lm_totales_act
"""

from alembic import op


revision = "20261111_cash_en_cierre"
down_revision = "20261024_lm_totales_act"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.drop_constraint("ck_erp_cash_periodos_estado_valid", "erp_cash_periodos", type_="check")
    op.create_check_constraint(
        "ck_erp_cash_periodos_estado_valid",
        "erp_cash_periodos",
        "estado IN ('ABIERTO', 'EN_CIERRE', 'CERRADO')",
    )


def downgrade() -> None:
    # Reabrir los provisionales antes de restaurar el contrato anterior.
    op.execute("UPDATE erp_cash_periodos SET estado = 'ABIERTO' WHERE estado = 'EN_CIERRE'")
    op.drop_constraint("ck_erp_cash_periodos_estado_valid", "erp_cash_periodos", type_="check")
    op.create_check_constraint(
        "ck_erp_cash_periodos_estado_valid",
        "erp_cash_periodos",
        "estado IN ('ABIERTO', 'CERRADO')",
    )
