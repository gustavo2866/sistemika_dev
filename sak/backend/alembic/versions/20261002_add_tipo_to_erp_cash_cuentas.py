"""add tipo to erp cash cuentas

Revision ID: 20261002_add_tipo_to_erp_cash_cuentas
Revises: 20260927_add_presentismo_autorizado_to_tarja_nomina
Create Date: 2026-10-02
"""

from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


revision: str = "20261002_add_tipo_to_erp_cash_cuentas"
down_revision: Union[str, Sequence[str], None] = "20260927_add_presentismo_autorizado_to_tarja_nomina"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column("erp_cash_cuentas", sa.Column("tipo", sa.CHAR(length=20), nullable=True))
    op.create_index("ix_erp_cash_cuentas_tipo", "erp_cash_cuentas", ["tipo"])
    op.execute(
        sa.text(
            """
            UPDATE erp_cash_cuentas
            SET tipo = CASE
                WHEN upper(trim(descripcion)) LIKE 'ING%' THEN 'Ingreso'
                WHEN upper(trim(descripcion)) LIKE 'EGR%' THEN 'Egreso'
                ELSE NULL
            END
            WHERE deleted_at IS NULL
            """
        )
    )
    op.create_check_constraint(
        "ck_erp_cash_cuentas_tipo_valid",
        "erp_cash_cuentas",
        "tipo IS NULL OR tipo IN ('Ingreso', 'Egreso')",
    )


def downgrade() -> None:
    op.drop_constraint("ck_erp_cash_cuentas_tipo_valid", "erp_cash_cuentas", type_="check")
    op.drop_index("ix_erp_cash_cuentas_tipo", table_name="erp_cash_cuentas")
    op.drop_column("erp_cash_cuentas", "tipo")