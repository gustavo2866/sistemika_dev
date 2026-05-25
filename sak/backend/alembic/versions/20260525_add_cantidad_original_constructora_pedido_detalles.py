"""add cantidad_original constructora pedido detalles

Revision ID: 20260525_add_cantidad_original_constructora_pedido_detalles
Revises: 20260524_add_estado_origen_constructora_pedido_detalles
Create Date: 2026-05-25
"""

from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


revision: str = "20260525_add_cantidad_original_constructora_pedido_detalles"
down_revision: Union[str, Sequence[str], None] = "20260524_add_estado_origen_constructora_pedido_detalles"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column(
        "constructora_pedido_detalles",
        sa.Column("cantidad_original", sa.DECIMAL(12, 3), nullable=True),
    )
    op.execute(
        """
        UPDATE constructora_pedido_detalles
        SET cantidad_original = cantidad
        WHERE cantidad_original IS NULL
        """
    )
    op.alter_column(
        "constructora_pedido_detalles",
        "cantidad_original",
        nullable=False,
        server_default="0",
        existing_type=sa.DECIMAL(12, 3),
    )


def downgrade() -> None:
    op.drop_column("constructora_pedido_detalles", "cantidad_original")
