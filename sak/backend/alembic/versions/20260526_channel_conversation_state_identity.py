"""channel_conversation_state_identity (stub)

Revision ID: 20260526_channel_conversation_state_identity
Revises: 20260525_add_cantidad_original_constructora_pedido_detalles
Create Date: 2026-05-26

NOTE: This is a stub for a migration applied to the remote DB.
      The actual schema changes are already present in the database.
"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa

revision: str = "20260526_channel_conversation_state_identity"
down_revision: Union[str, None] = "20260525_add_cantidad_original_constructora_pedido_detalles"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    pass


def downgrade() -> None:
    pass
