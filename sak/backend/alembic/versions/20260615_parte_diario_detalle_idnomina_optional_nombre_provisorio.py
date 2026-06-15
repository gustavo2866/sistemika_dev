"""parte_diario_detalle: idnomina opcional y campo nombre_provisorio

Revision ID: 20260615_parte_diario_detalle_idnomina_optional_nombre_provisorio
Revises: 20260601_add_agent_turn_lease
Create Date: 2026-06-15

"""
from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op

revision: str = "20260615_pdd_idnomina_opt"
down_revision: Union[str, None] = "20260601_add_agent_turn_lease"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # idnomina: NOT NULL -> NULL
    op.alter_column(
        "partes_diario_detalles",
        "idnomina",
        existing_type=sa.Integer(),
        nullable=True,
    )
    # nuevo campo nombre_provisorio
    op.add_column(
        "partes_diario_detalles",
        sa.Column("nombre_provisorio", sa.String(length=200), nullable=True),
    )


def downgrade() -> None:
    op.drop_column("partes_diario_detalles", "nombre_provisorio")
    op.alter_column(
        "partes_diario_detalles",
        "idnomina",
        existing_type=sa.Integer(),
        nullable=False,
    )
