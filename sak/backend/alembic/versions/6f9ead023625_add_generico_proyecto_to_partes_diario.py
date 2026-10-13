"""add_generico_proyecto_to_partes_diario

Revision ID: 6f9ead023625
Revises: 20261017_add_generico_to_proyectos
Create Date: 2026-10-12 23:23:34.823015

"""

from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op

revision: str = "6f9ead023625"
down_revision: Union[str, Sequence[str], None] = "20261017_add_generico_to_proyectos"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column(
        "partes_diario",
        sa.Column("generico_proyecto_id", sa.Integer(), nullable=True),
    )
    op.execute(sa.text("UPDATE partes_diario SET generico_proyecto_id = NULL"))
    op.create_index(
        op.f("ix_partes_diario_generico_proyecto_id"),
        "partes_diario",
        ["generico_proyecto_id"],
        unique=False,
    )
    op.create_foreign_key(
        "fk_partes_diario_generico_proyecto_id",
        "partes_diario",
        "proyectos",
        ["generico_proyecto_id"],
        ["id"],
    )


def downgrade() -> None:
    op.drop_constraint("fk_partes_diario_generico_proyecto_id", "partes_diario", type_="foreignkey")
    op.drop_index(op.f("ix_partes_diario_generico_proyecto_id"), table_name="partes_diario")
    op.drop_column("partes_diario", "generico_proyecto_id")