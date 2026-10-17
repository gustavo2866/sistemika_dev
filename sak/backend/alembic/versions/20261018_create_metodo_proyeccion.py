"""create metodo_proyeccion and metodo_proyeccion_detalle tables

Revision ID: 20261018_create_metodo_proyeccion
Revises: 6f9ead023625
Create Date: 2026-10-18
"""

from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op


revision: str = "20261018_create_metodo_proyeccion"
down_revision: Union[str, Sequence[str], None] = "6f9ead023625"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table(
        "metodo_proyeccion",
        sa.Column("id", sa.Integer(), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("deleted_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("version", sa.Integer(), nullable=False, server_default="1"),
        sa.Column("nombre", sa.String(length=200), nullable=False),
        sa.Column("descripcion", sa.String(length=1000), nullable=True),
        sa.Column("activo", sa.Boolean(), nullable=False, server_default=sa.text("true")),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index("ix_metodo_proyeccion_nombre", "metodo_proyeccion", ["nombre"], unique=True)

    op.create_table(
        "metodo_proyeccion_detalle",
        sa.Column("id", sa.Integer(), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("deleted_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("version", sa.Integer(), nullable=False, server_default="1"),
        sa.Column("id_metodo_proyeccion", sa.Integer(), nullable=False),
        sa.Column("mes_destino", sa.Integer(), nullable=False),
        sa.Column("mes_base_desde", sa.Integer(), nullable=False),
        sa.Column("mes_base_hasta", sa.Integer(), nullable=False),
        sa.Column("funcion", sa.String(length=20), nullable=False),
        sa.Column("factor", sa.DECIMAL(precision=10, scale=4), nullable=False, server_default="1"),
        sa.ForeignKeyConstraint(["id_metodo_proyeccion"], ["metodo_proyeccion.id"], ondelete="CASCADE"),
        sa.CheckConstraint("mes_destino BETWEEN 1 AND 12", name="ck_metodo_proyeccion_detalle_mes_destino"),
        sa.CheckConstraint("mes_base_desde <= mes_base_hasta", name="ck_metodo_proyeccion_detalle_mes_base_rango"),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index(
        "ix_metodo_proyeccion_detalle_id_metodo_proyeccion",
        "metodo_proyeccion_detalle",
        ["id_metodo_proyeccion"],
        unique=False,
    )


def downgrade() -> None:
    op.drop_index("ix_metodo_proyeccion_detalle_id_metodo_proyeccion", table_name="metodo_proyeccion_detalle")
    op.drop_table("metodo_proyeccion_detalle")
    op.drop_index("ix_metodo_proyeccion_nombre", table_name="metodo_proyeccion")
    op.drop_table("metodo_proyeccion")
