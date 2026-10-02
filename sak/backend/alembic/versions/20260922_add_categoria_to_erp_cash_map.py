"""add categoria to erp cash map

Revision ID: 20260922_add_categoria_to_erp_cash_map
Revises: 20260922_drop_erp_cash_map_unique_pair
Create Date: 2026-09-22
"""

from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


revision: str = "20260922_add_categoria_to_erp_cash_map"
down_revision: Union[str, Sequence[str], None] = "20260922_drop_erp_cash_map_unique_pair"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column("erp_cash_map", sa.Column("categoria", sa.String(length=50), nullable=True))
    op.create_index("ix_erp_cash_map_categoria", "erp_cash_map", ["categoria"])


def downgrade() -> None:
    op.drop_index("ix_erp_cash_map_categoria", table_name="erp_cash_map")
    op.drop_column("erp_cash_map", "categoria")