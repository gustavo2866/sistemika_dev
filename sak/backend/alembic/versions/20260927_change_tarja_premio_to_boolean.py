"""change tarja premio to boolean

Revision ID: 20260927_change_tarja_premio_to_boolean
Revises: 20260922_rename_erp_cash_diarios_plural
Create Date: 2026-09-27
"""

from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op


revision: str = "20260927_change_tarja_premio_to_boolean"
down_revision: Union[str, Sequence[str], None] = "20260922_rename_erp_cash_diarios_plural"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.alter_column(
        "tarjas",
        "premio",
        existing_type=sa.DECIMAL(12, 2),
        server_default=None,
        existing_nullable=False,
    )
    op.alter_column(
        "tarjas",
        "premio",
        existing_type=sa.DECIMAL(12, 2),
        type_=sa.Boolean(),
        existing_nullable=False,
        postgresql_using="false",
    )
    op.alter_column(
        "tarjas",
        "premio",
        existing_type=sa.Boolean(),
        server_default=sa.text("false"),
        existing_nullable=False,
    )


def downgrade() -> None:
    op.alter_column(
        "tarjas",
        "premio",
        existing_type=sa.Boolean(),
        server_default=None,
        existing_nullable=False,
    )
    op.alter_column(
        "tarjas",
        "premio",
        existing_type=sa.Boolean(),
        type_=sa.DECIMAL(12, 2),
        existing_nullable=False,
        postgresql_using="CASE WHEN premio THEN 1 ELSE 0 END",
    )
    op.alter_column(
        "tarjas",
        "premio",
        existing_type=sa.DECIMAL(12, 2),
        server_default="0",
        existing_nullable=False,
    )