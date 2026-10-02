"""drop erp cash map unique pair

Revision ID: 20260922_drop_erp_cash_map_unique_pair
Revises: 20260922_create_erp_cash_module
Create Date: 2026-09-22
"""

from typing import Sequence, Union

from alembic import op


revision: str = "20260922_drop_erp_cash_map_unique_pair"
down_revision: Union[str, Sequence[str], None] = "20260922_create_erp_cash_module"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.drop_constraint("uq_erp_cash_map_nro_cta_moneda", "erp_cash_map", type_="unique")


def downgrade() -> None:
    op.create_unique_constraint(
        "uq_erp_cash_map_nro_cta_moneda",
        "erp_cash_map",
        ["nro_cta", "moneda"],
    )