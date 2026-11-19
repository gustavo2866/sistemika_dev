"""allow active cash subaccounts without category

Revision ID: 699f251847ed
Revises: 4a9ed248e4b0
Create Date: 2026-11-19 08:45:28.558192

"""
from typing import Sequence, Union

from alembic import op


# revision identifiers, used by Alembic.
revision: str = '699f251847ed'
down_revision: Union[str, Sequence[str], None] = '4a9ed248e4b0'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Upgrade schema."""
    op.drop_constraint("ck_cash_subcta_activa_categoria", "erp_cash_subctas", type_="check")


def downgrade() -> None:
    """Downgrade schema."""
    op.create_check_constraint(
        "ck_cash_subcta_activa_categoria",
        "erp_cash_subctas",
        "estado <> 'activa' OR (categoria IS NOT NULL AND trim(categoria) <> '' AND lower(trim(categoria)) <> 'error')",
    )
