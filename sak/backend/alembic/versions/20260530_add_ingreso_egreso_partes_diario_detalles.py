"""add_ingreso_egreso_to_partes_diario_detalles

Revision ID: 20260530_add_ingreso_egreso_partes_diario_detalles
Revises: 20260530_parte_diario_estados
Create Date: 2026-05-30

"""
from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op

revision: str = "20260530_add_ingreso_egreso_partes_diario_detalles"
down_revision: Union[str, None] = "20260530_parte_diario_estados"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column("partes_diario_detalles", sa.Column("ingreso", sa.DateTime(timezone=True), nullable=True))
    op.add_column("partes_diario_detalles", sa.Column("egreso", sa.DateTime(timezone=True), nullable=True))


def downgrade() -> None:
    op.drop_column("partes_diario_detalles", "egreso")
    op.drop_column("partes_diario_detalles", "ingreso")
