"""create tarja_nomina table

Revision ID: 20260904_create_tarja_nomina_table
Revises: 20260901_move_nomina_catalogs_from_tarja_detalles_to_novedades
Create Date: 2026-09-04
"""

from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op
from sqlalchemy.dialects import postgresql


revision: str = "20260904_create_tarja_nomina_table"
down_revision: Union[str, Sequence[str], None] = "20260901_move_nomina_catalogs_from_tarja_detalles_to_novedades"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table(
        "tarja_nomina",
        sa.Column("id", sa.Integer(), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("deleted_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("version", sa.Integer(), nullable=False, server_default="1"),
        sa.Column("tarja_id", sa.Integer(), nullable=False),
        sa.Column("nomina_id", sa.Integer(), nullable=True),
        sa.Column("nomina_categoria_id", sa.Integer(), nullable=True),
        sa.Column("nomina_tarea_id", sa.Integer(), nullable=True),
        sa.Column("horas_justificadas", sa.DECIMAL(8, 2), nullable=False, server_default="0"),
        sa.Column("presentismo", sa.Boolean(), nullable=False, server_default=sa.text("false")),
        sa.Column("presentismo_importe", sa.DECIMAL(12, 2), nullable=False, server_default="0"),
        sa.Column("adicional_importe", sa.DECIMAL(12, 2), nullable=False, server_default="0"),
        sa.Column("premio", sa.Boolean(), nullable=False, server_default=sa.text("false")),
        sa.Column("premio_importe", sa.DECIMAL(12, 2), nullable=False, server_default="0"),
        sa.Column("viatico", sa.Boolean(), nullable=False, server_default=sa.text("false")),
        sa.Column("viatico_importe", sa.DECIMAL(12, 2), nullable=False, server_default="0"),
        sa.Column("sueldo_importe", sa.DECIMAL(12, 2), nullable=False, server_default="0"),
        sa.Column("mejora_importe", sa.DECIMAL(12, 2), nullable=False, server_default="0"),
        sa.Column("cargas_importe", sa.DECIMAL(12, 2), nullable=False, server_default="0"),
        sa.Column("fecha_desde", sa.Date(), nullable=False),
        sa.Column("fecha_hasta", sa.Date(), nullable=False),
        sa.Column("observaciones", sa.String(length=1000), nullable=True),
        sa.Column("documentos", postgresql.JSONB(astext_type=sa.Text()), nullable=True),
        sa.ForeignKeyConstraint(["tarja_id"], ["tarjas.id"]),
        sa.ForeignKeyConstraint(["nomina_id"], ["nominas.id"]),
        sa.ForeignKeyConstraint(["nomina_categoria_id"], ["nomina_categorias.id"]),
        sa.ForeignKeyConstraint(["nomina_tarea_id"], ["nomina_tareas.id"]),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("tarja_id", "nomina_id", name="uq_tarja_nomina_tarja_nomina"),
    )
    op.create_index("ix_tarja_nomina_tarja_id", "tarja_nomina", ["tarja_id"], unique=False)
    op.create_index("ix_tarja_nomina_nomina_id", "tarja_nomina", ["nomina_id"], unique=False)


def downgrade() -> None:
    op.drop_index("ix_tarja_nomina_nomina_id", table_name="tarja_nomina")
    op.drop_index("ix_tarja_nomina_tarja_id", table_name="tarja_nomina")
    op.drop_table("tarja_nomina")
