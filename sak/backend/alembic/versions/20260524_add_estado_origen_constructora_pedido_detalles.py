"""add estado origen constructora pedido detalles

Revision ID: 20260524_add_estado_origen_constructora_pedido_detalles
Revises: 20260523_add_constructora_pedidos
Create Date: 2026-05-24

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa

revision: str = "20260524_add_estado_origen_constructora_pedido_detalles"
down_revision: Union[str, Sequence[str], None] = "20260523_add_constructora_pedidos"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column(
        "constructora_pedido_detalles",
        sa.Column("estado", sa.String(length=20), nullable=False, server_default="activa"),
    )
    op.add_column(
        "constructora_pedido_detalles",
        sa.Column("origen", sa.String(length=20), nullable=False, server_default="manual"),
    )
    op.create_index(
        "ix_constructora_pedido_detalles_estado",
        "constructora_pedido_detalles",
        ["estado"],
    )
    op.create_index(
        "ix_constructora_pedido_detalles_origen",
        "constructora_pedido_detalles",
        ["origen"],
    )
    op.execute(
        """
        UPDATE constructora_pedido_detalles d
        SET origen = 'agente'
        FROM constructora_pedidos p
        WHERE d.pedido_id = p.id
          AND (
            p.origen = 'agente'
            OR d.metadata ? 'agent_item_id'
          )
        """
    )


def downgrade() -> None:
    op.drop_index("ix_constructora_pedido_detalles_origen", table_name="constructora_pedido_detalles")
    op.drop_index("ix_constructora_pedido_detalles_estado", table_name="constructora_pedido_detalles")
    op.drop_column("constructora_pedido_detalles", "origen")
    op.drop_column("constructora_pedido_detalles", "estado")
