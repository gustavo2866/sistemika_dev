"""rename erp cash diario table to plural

Revision ID: 20260922_rename_erp_cash_diarios_plural
Revises: 20260922_create_erp_cash_diario
Create Date: 2026-09-22
"""

from typing import Sequence, Union

from alembic import op


revision: str = "20260922_rename_erp_cash_diarios_plural"
down_revision: Union[str, Sequence[str], None] = "20260922_create_erp_cash_diario"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


INDEX_SUFFIXES = (
    "source_id",
    "empresa_id",
    "fecha",
    "periodo_anio",
    "periodo_mes",
    "cuenta_codigo",
    "rubro",
    "cash",
    "cuenta_cash_id",
)


def upgrade() -> None:
    op.rename_table("erp_cash_diario", "erp_cash_diarios")
    for suffix in INDEX_SUFFIXES:
        op.execute(
            f"ALTER INDEX ix_erp_cash_diario_{suffix} "
            f"RENAME TO ix_erp_cash_diarios_{suffix}"
        )
    op.execute(
        "ALTER INDEX idx_erp_cash_diario_empresa_periodo "
        "RENAME TO idx_erp_cash_diarios_empresa_periodo"
    )


def downgrade() -> None:
    op.execute(
        "ALTER INDEX idx_erp_cash_diarios_empresa_periodo "
        "RENAME TO idx_erp_cash_diario_empresa_periodo"
    )
    for suffix in INDEX_SUFFIXES:
        op.execute(
            f"ALTER INDEX ix_erp_cash_diarios_{suffix} "
            f"RENAME TO ix_erp_cash_diario_{suffix}"
        )
    op.rename_table("erp_cash_diarios", "erp_cash_diario")
