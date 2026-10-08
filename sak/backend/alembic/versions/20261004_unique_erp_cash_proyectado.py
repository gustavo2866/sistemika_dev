"""add active unique index to erp cash proyectado

Revision ID: 20261004_unique_erp_cash_proyectado
Revises: 20261004_create_erp_cash_proyectado
Create Date: 2026-10-04
"""

from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


revision: str = "20261004_unique_erp_cash_proyectado"
down_revision: Union[str, Sequence[str], None] = "20261004_create_erp_cash_proyectado"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_index(
        "uq_erp_cash_proyectado_activo_cuenta_periodo_tipo",
        "erp_cash_proyectado",
        ["cuenta_cash_id", "fecha_periodo", "tipo"],
        unique=True,
        postgresql_where=sa.text("deleted_at IS NULL"),
    )


def downgrade() -> None:
    op.drop_index(
        "uq_erp_cash_proyectado_activo_cuenta_periodo_tipo",
        table_name="erp_cash_proyectado",
    )
