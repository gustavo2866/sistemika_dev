"""Add descripcion to contratos_archivos

Revision ID: 20260419_add_descripcion_to_contratos_archivos
Revises: 20260416_seed_vacancia_setting, d4e5f6a1b2c3
Create Date: 2026-04-19 00:00:00.000000

"""
from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op

revision: str = "20260419_add_descripcion_to_contratos_archivos"
down_revision: Union[str, Sequence[str], None] = ("20260416_seed_vacancia_setting", "d4e5f6a1b2c3")
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column(
        "contratos_archivos",
        sa.Column("descripcion", sa.String(length=500), nullable=True),
    )


def downgrade() -> None:
    op.drop_column("contratos_archivos", "descripcion")
