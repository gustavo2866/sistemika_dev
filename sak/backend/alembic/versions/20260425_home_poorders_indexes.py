"""add home dashboard poorders indexes

Revision ID: 20260425_home_poorders_indexes
Revises: dec3dfc250f3
Create Date: 2026-04-25

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = "20260425_home_poorders_indexes"
down_revision: Union[str, Sequence[str], None] = "dec3dfc250f3"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Upgrade schema."""
    active_orders = sa.text("deleted_at IS NULL")
    op.create_index(
        "idx_po_orders_home_status_active",
        "po_orders",
        ["order_status_id"],
        unique=False,
        postgresql_where=active_orders,
        sqlite_where=active_orders,
    )
    op.create_index(
        "idx_po_orders_home_solicitante_status_active",
        "po_orders",
        ["solicitante_id", "order_status_id"],
        unique=False,
        postgresql_where=active_orders,
        sqlite_where=active_orders,
    )


def downgrade() -> None:
    """Downgrade schema."""
    op.drop_index("idx_po_orders_home_solicitante_status_active", table_name="po_orders")
    op.drop_index("idx_po_orders_home_status_active", table_name="po_orders")
