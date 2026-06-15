"""constructora_pedidos: pendiente->borrador, confirmado->cerrado

Revision ID: 20260615_pedido_estado_borrador_cerrado
Revises: 20260615_pdd_idnomina_opt
Create Date: 2026-06-15

"""
from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op

revision: str = "20260615_pedido_estado_borrador_cerrado"
down_revision: Union[str, None] = "20260615_pdd_idnomina_opt"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    conn = op.get_bind()
    conn.execute(sa.text(
        "UPDATE constructora_pedidos SET estado = 'borrador' WHERE estado = 'pendiente'"
    ))
    conn.execute(sa.text(
        "UPDATE constructora_pedidos SET estado = 'cerrado' WHERE estado = 'confirmado'"
    ))
    conn.execute(sa.text(
        "ALTER TABLE constructora_pedidos ALTER COLUMN estado SET DEFAULT 'borrador'"
    ))


def downgrade() -> None:
    conn = op.get_bind()
    conn.execute(sa.text(
        "UPDATE constructora_pedidos SET estado = 'pendiente' WHERE estado = 'borrador'"
    ))
    conn.execute(sa.text(
        "UPDATE constructora_pedidos SET estado = 'confirmado' WHERE estado = 'cerrado'"
    ))
    conn.execute(sa.text(
        "ALTER TABLE constructora_pedidos ALTER COLUMN estado SET DEFAULT 'pendiente'"
    ))
