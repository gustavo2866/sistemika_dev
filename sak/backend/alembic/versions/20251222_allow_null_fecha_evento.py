"""Allow null fecha_evento in crm_eventos

Revision ID: 20251222_allow_null_fecha_evento
Revises: cd91a1abf4f0
Create Date: 2025-12-22
"""

from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa

revision: str = "20251222_allow_null_fecha_evento"
down_revision: Union[str, Sequence[str], None] = "cd91a1abf4f0"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.alter_column(
        "crm_eventos",
        "fecha_evento",
        existing_type=sa.DateTime(),
        nullable=True,
    )


def downgrade() -> None:
    op.execute("UPDATE crm_eventos SET fecha_evento = NOW() WHERE fecha_evento IS NULL")
    op.alter_column(
        "crm_eventos",
        "fecha_evento",
        existing_type=sa.DateTime(),
        nullable=False,
    )
