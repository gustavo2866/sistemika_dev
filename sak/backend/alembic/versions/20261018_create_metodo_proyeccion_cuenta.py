"""create metodo_proyeccion_cuenta table

Revision ID: 20261018_create_metodo_proyeccion_cuenta
Revises: 20261018_add_metodo_proyeccion_to_erp_cash_cuentas
Create Date: 2026-10-18
"""

from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op


revision: str = "20261018_create_metodo_proyeccion_cuenta"
down_revision: Union[str, Sequence[str], None] = "20261018_allow_null_funcion_metodo_proyeccion"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table(
        "metodo_proyeccion_cuenta",
        sa.Column("id", sa.Integer(), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("deleted_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("version", sa.Integer(), nullable=False, server_default="1"),
        sa.Column("id_metodo_proyeccion", sa.Integer(), nullable=False),
        sa.Column("nro_cuenta", sa.Integer(), nullable=False),
        sa.Column("activo", sa.Boolean(), nullable=False, server_default=sa.text("true")),
        sa.ForeignKeyConstraint(
            ["id_metodo_proyeccion"],
            ["metodo_proyeccion.id"],
            ondelete="CASCADE",
        ),
        sa.UniqueConstraint("id_metodo_proyeccion", "nro_cuenta", name="uq_metodo_proyeccion_cuenta"),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index(
        "ix_metodo_proyeccion_cuenta_id_metodo_proyeccion",
        "metodo_proyeccion_cuenta",
        ["id_metodo_proyeccion"],
    )
    op.create_index(
        "ix_metodo_proyeccion_cuenta_nro_cuenta",
        "metodo_proyeccion_cuenta",
        ["nro_cuenta"],
    )


def downgrade() -> None:
    op.drop_index("ix_metodo_proyeccion_cuenta_nro_cuenta", table_name="metodo_proyeccion_cuenta")
    op.drop_index("ix_metodo_proyeccion_cuenta_id_metodo_proyeccion", table_name="metodo_proyeccion_cuenta")
    op.drop_constraint("uq_metodo_proyeccion_cuenta", "metodo_proyeccion_cuenta", type_="unique")
    op.drop_table("metodo_proyeccion_cuenta")
