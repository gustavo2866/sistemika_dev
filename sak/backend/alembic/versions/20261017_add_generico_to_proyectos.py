"""add generico flag to proyectos

Revision ID: 20261017_add_generico_to_proyectos
Revises: 20261016_fix_jornada_sunday_zero
Create Date: 2026-10-17
"""

from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op


revision: str = "20261017_add_generico_to_proyectos"
down_revision: Union[str, Sequence[str], None] = "20261016_fix_jornada_sunday_zero"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column(
        "proyectos",
        sa.Column("generico", sa.Boolean(), nullable=False, server_default=sa.text("false")),
    )
    op.execute(sa.text("UPDATE proyectos SET generico = false WHERE generico IS NULL"))


def downgrade() -> None:
    op.drop_column("proyectos", "generico")
