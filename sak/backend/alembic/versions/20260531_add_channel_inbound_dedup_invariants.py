"""add inbound webhook deduplication invariants

Revision ID: 20260531_add_channel_inbound_dedup_invariants
Revises: 20260531_add_parte_diario_invariants
Create Date: 2026-05-31

"""
from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op

revision: str = "20260531_add_channel_inbound_dedup_invariants"
down_revision: Union[str, None] = "20260531_add_parte_diario_invariants"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_index(
        "uq_crm_mensajes_inbound_origen_externo_id_active",
        "crm_mensajes",
        ["origen_externo_id"],
        unique=True,
        postgresql_where=sa.text(
            "deleted_at IS NULL AND tipo = 'entrada' AND origen_externo_id IS NOT NULL"
        ),
    )
    op.create_index(
        "uq_channel_events_inbound_external_message_active",
        "channel_events",
        ["provider", "channel_type", "external_message_id"],
        unique=True,
        postgresql_where=sa.text(
            "deleted_at IS NULL AND direction = 'inbound' AND external_message_id IS NOT NULL"
        ),
    )


def downgrade() -> None:
    op.drop_index(
        "uq_channel_events_inbound_external_message_active",
        table_name="channel_events",
    )
    op.drop_index(
        "uq_crm_mensajes_inbound_origen_externo_id_active",
        table_name="crm_mensajes",
    )
