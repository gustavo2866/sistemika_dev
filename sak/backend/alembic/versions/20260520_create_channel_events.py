"""create channel_events

Revision ID: 20260520_create_channel_events
Revises: 20260502_add_descripcion_proy_presupuesto
Create Date: 2026-05-20

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


revision: str = "20260520_create_channel_events"
down_revision: Union[str, Sequence[str], None] = "20260502_add_descripcion_proy_presupuesto"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table(
        "channel_events",
        sa.Column("provider", sa.String(length=50), nullable=False),
        sa.Column("channel_type", sa.String(length=50), nullable=False),
        sa.Column("account_ref", sa.String(length=255), nullable=False),
        sa.Column("external_account_id", sa.String(length=255), nullable=True),
        sa.Column("direction", sa.String(length=30), nullable=False),
        sa.Column("from_address", sa.String(length=255), nullable=True),
        sa.Column("to_address", sa.String(length=255), nullable=True),
        sa.Column("external_message_id", sa.String(length=255), nullable=True),
        sa.Column("external_event_id", sa.String(length=255), nullable=True),
        sa.Column("status", sa.String(length=50), nullable=True),
        sa.Column("occurred_at", sa.DateTime(), nullable=False),
        sa.Column("raw_payload", sa.JSON(), nullable=False),
        sa.Column("normalized_payload", sa.JSON(), nullable=False),
        sa.Column("id", sa.Integer(), nullable=False),
        sa.Column("created_at", sa.DateTime(), nullable=False),
        sa.Column("updated_at", sa.DateTime(), nullable=False),
        sa.Column("deleted_at", sa.DateTime(), nullable=True),
        sa.Column("version", sa.Integer(), nullable=False),
        sa.PrimaryKeyConstraint("id"),
    )
    for column in [
        "provider",
        "channel_type",
        "account_ref",
        "external_account_id",
        "direction",
        "from_address",
        "to_address",
        "external_message_id",
        "external_event_id",
        "status",
        "occurred_at",
    ]:
        op.create_index(op.f(f"ix_channel_events_{column}"), "channel_events", [column], unique=False)


def downgrade() -> None:
    for column in [
        "occurred_at",
        "status",
        "external_event_id",
        "external_message_id",
        "to_address",
        "from_address",
        "direction",
        "external_account_id",
        "account_ref",
        "channel_type",
        "provider",
    ]:
        op.drop_index(op.f(f"ix_channel_events_{column}"), table_name="channel_events")
    op.drop_table("channel_events")
