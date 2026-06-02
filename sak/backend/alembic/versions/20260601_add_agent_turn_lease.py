"""add durable agent turn lease

Revision ID: 20260601_add_agent_turn_lease
Revises: 20260531_add_channel_inbound_dedup_invariants
Create Date: 2026-06-01

"""
from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op

revision: str = "20260601_add_agent_turn_lease"
down_revision: Union[str, None] = "20260531_add_channel_inbound_dedup_invariants"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column(
        "agente_conversation_states",
        sa.Column("lease_token", sa.String(length=64), nullable=True),
    )
    op.add_column(
        "agente_conversation_states",
        sa.Column("lease_expires_at", sa.DateTime(timezone=True), nullable=True),
    )
    op.create_index(
        "ix_agente_conversation_states_lease_expires_at",
        "agente_conversation_states",
        ["lease_expires_at"],
        unique=False,
    )


def downgrade() -> None:
    op.drop_index(
        "ix_agente_conversation_states_lease_expires_at",
        table_name="agente_conversation_states",
    )
    op.drop_column("agente_conversation_states", "lease_expires_at")
    op.drop_column("agente_conversation_states", "lease_token")
