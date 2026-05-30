"""create_parte_diario_estados_and_update_detalles

Revision ID: 20260530_parte_diario_estados
Revises: 20260530_add_fecha_egreso_nro_legajo_to_nominas
Create Date: 2026-05-30

"""
from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op

revision: str = "20260530_parte_diario_estados"
down_revision: Union[str, None] = "20260530_add_fecha_egreso_nro_legajo_to_nominas"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # 1. Crear tabla parte_diario_estados
    op.create_table(
        "parte_diario_estados",
        sa.Column("id", sa.Integer(), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("deleted_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("version", sa.Integer(), nullable=False, server_default="1"),
        sa.Column("abreviatura", sa.String(length=10), nullable=False),
        sa.Column("nombre", sa.String(length=100), nullable=False),
        sa.Column("activo", sa.Boolean(), nullable=False, server_default="true"),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index("ix_parte_diario_estados_abreviatura", "parte_diario_estados", ["abreviatura"], unique=True)

    # 2. Quitar columna tipolicencia de partes_diario_detalles
    op.drop_column("partes_diario_detalles", "tipolicencia")

    # 3. Agregar FK idestado a partes_diario_detalles
    op.add_column(
        "partes_diario_detalles",
        sa.Column("idestado", sa.Integer(), nullable=True),
    )
    op.create_foreign_key(
        "fk_partes_diario_detalles_idestado",
        "partes_diario_detalles",
        "parte_diario_estados",
        ["idestado"],
        ["id"],
    )


def downgrade() -> None:
    op.drop_constraint("fk_partes_diario_detalles_idestado", "partes_diario_detalles", type_="foreignkey")
    op.drop_column("partes_diario_detalles", "idestado")
    op.add_column(
        "partes_diario_detalles",
        sa.Column("tipolicencia", sa.String(length=20), nullable=True),
    )
    op.drop_index("ix_parte_diario_estados_abreviatura", table_name="parte_diario_estados")
    op.drop_table("parte_diario_estados")
