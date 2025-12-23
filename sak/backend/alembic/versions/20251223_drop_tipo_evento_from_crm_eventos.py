"""drop tipo_evento from crm_eventos

Revision ID: 20251223_drop_tipo_evento
Revises: de2846bac742
Create Date: 2025-12-23 00:00:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


revision: str = "20251223_drop_tipo_evento"
down_revision: Union[str, Sequence[str], None] = "de2846bac742"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.execute("DROP INDEX IF EXISTS ix_crm_eventos_tipo_evento")
    op.execute("DROP INDEX IF EXISTS idx_crm_eventos_tipo")
    op.execute("ALTER TABLE crm_eventos DROP COLUMN IF EXISTS tipo_evento")


def downgrade() -> None:
    op.add_column("crm_eventos", sa.Column("tipo_evento", sa.String(length=20), nullable=True))
    op.create_index("ix_crm_eventos_tipo_evento", "crm_eventos", ["tipo_evento"])
