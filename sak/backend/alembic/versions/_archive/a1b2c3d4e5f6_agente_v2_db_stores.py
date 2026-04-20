"""agente_v2_db_stores

Revision ID: a1b2c3d4e5f6
Revises: c04054590260
Create Date: 2026-04-06 08:56:38.018040

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql


# revision identifiers, used by Alembic.
revision: str = 'a1b2c3d4e5f6'
down_revision: Union[str, Sequence[str], None] = 'c04054590260'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table(
        "agente_conversation_states",
        sa.Column("oportunidad_id", sa.Integer(), nullable=False),
        sa.Column("active_process", sa.String(length=100), nullable=True),
        sa.Column("process_state", postgresql.JSONB(), nullable=False, server_default="{}"),
        sa.Column("last_message_id", sa.Integer(), nullable=True),
        sa.Column("last_outbound_message_id", sa.Integer(), nullable=True),
        sa.Column("version", sa.Integer(), nullable=False, server_default="1"),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False),
        sa.ForeignKeyConstraint(["last_message_id"], ["crm_mensajes.id"], ondelete="SET NULL"),
        sa.ForeignKeyConstraint(["oportunidad_id"], ["crm_oportunidades.id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("oportunidad_id"),
    )

    op.create_table(
        "agente_process_requests",
        sa.Column("id", sa.Integer(), nullable=False, autoincrement=True),
        sa.Column("oportunidad_id", sa.Integer(), nullable=False),
        sa.Column("proceso", sa.String(length=100), nullable=False),
        sa.Column("activa", sa.Boolean(), nullable=False, server_default="true"),
        sa.Column("estado", sa.String(length=50), nullable=False, server_default="draft"),
        sa.Column("payload", postgresql.JSONB(), nullable=False, server_default="{}"),
        sa.Column("version", sa.Integer(), nullable=False, server_default="1"),
        sa.Column("ultimo_mensaje_id", sa.Integer(), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False),
        sa.ForeignKeyConstraint(["oportunidad_id"], ["crm_oportunidades.id"], ondelete="CASCADE"),
        sa.ForeignKeyConstraint(["ultimo_mensaje_id"], ["crm_mensajes.id"], ondelete="SET NULL"),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("oportunidad_id", "proceso", name="uq_agente_request_oportunidad_proceso"),
    )
    op.create_index("ix_agente_process_requests_oportunidad_id", "agente_process_requests", ["oportunidad_id"])
    op.create_index("ix_agente_process_requests_proceso", "agente_process_requests", ["proceso"])


def downgrade() -> None:
    op.drop_index("ix_agente_process_requests_proceso", table_name="agente_process_requests")
    op.drop_index("ix_agente_process_requests_oportunidad_id", table_name="agente_process_requests")
    op.drop_table("agente_process_requests")
    op.drop_table("agente_conversation_states")
