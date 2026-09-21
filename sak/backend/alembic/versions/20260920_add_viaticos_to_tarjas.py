"""add viaticos to tarjas

Revision ID: 20260920_add_viaticos_to_tarjas
Revises: 20260920_add_premio_to_tarjas
Create Date: 2026-09-20
"""

from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op


revision: str = "20260920_add_viaticos_to_tarjas"
down_revision: Union[str, Sequence[str], None] = "20260920_add_premio_to_tarjas"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column(
        "tarjas",
        sa.Column("viaticos", sa.Boolean(), nullable=False, server_default=sa.text("false")),
    )


def downgrade() -> None:
    op.drop_column("tarjas", "viaticos")