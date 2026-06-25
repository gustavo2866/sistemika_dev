"""create_tarja_tables

Revision ID: 20260622_create_tarja_tables
Revises: 20260615_pedido_estado_borrador_cerrado
Create Date: 2026-06-22

"""
from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op
from sqlalchemy.dialects import postgresql

revision: str = "20260622_create_tarja_tables"
down_revision: Union[str, None] = "20260615_pedido_estado_borrador_cerrado"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table(
        "tarjas",
        sa.Column("id", sa.Integer(), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("deleted_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("version", sa.Integer(), nullable=False, server_default="1"),
        sa.Column("idproyecto", sa.Integer(), nullable=False),
        sa.Column("fechainicio", sa.Date(), nullable=False),
        sa.Column("fechafinal", sa.Date(), nullable=False),
        sa.Column("estado", sa.String(length=20), nullable=False),
        sa.Column("descripcion", sa.String(length=1000), nullable=True),
        sa.ForeignKeyConstraint(["idproyecto"], ["proyectos.id"]),
        sa.PrimaryKeyConstraint("id"),
    )

    op.create_table(
        "tarja_detalles",
        sa.Column("id", sa.Integer(), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("deleted_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("version", sa.Integer(), nullable=False, server_default="1"),
        sa.Column("tarja_id", sa.Integer(), nullable=False),
        sa.Column("idnomina", sa.Integer(), nullable=True),
        sa.Column("fecha", sa.Date(), nullable=False),
        sa.Column("idestado", sa.Integer(), nullable=True),
        sa.Column("horas", sa.DECIMAL(5, 2), nullable=False),
        sa.Column("descripcion", sa.String(length=500), nullable=True),
        sa.Column("parte_diario_detalle_id", sa.Integer(), nullable=True),
        sa.ForeignKeyConstraint(["idestado"], ["parte_diario_estados.id"]),
        sa.ForeignKeyConstraint(["idnomina"], ["nominas.id"]),
        sa.ForeignKeyConstraint(["parte_diario_detalle_id"], ["partes_diario_detalles.id"]),
        sa.ForeignKeyConstraint(["tarja_id"], ["tarjas.id"]),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("tarja_id", "idnomina", "fecha", name="uq_tarja_detalles_tarja_nomina_fecha"),
    )
    op.create_index("ix_tarja_detalles_tarja_id", "tarja_detalles", ["tarja_id"], unique=False)
    op.create_index("ix_tarja_detalles_idnomina", "tarja_detalles", ["idnomina"], unique=False)
    op.create_index("ix_tarja_detalles_idestado", "tarja_detalles", ["idestado"], unique=False)
    op.create_index(
        "ix_tarja_detalles_parte_diario_detalle_id",
        "tarja_detalles",
        ["parte_diario_detalle_id"],
        unique=False,
    )

    op.create_table(
        "tarja_novedades",
        sa.Column("id", sa.Integer(), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("deleted_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("version", sa.Integer(), nullable=False, server_default="1"),
        sa.Column("tarja_id", sa.Integer(), nullable=False),
        sa.Column("horas_enfermedad_justif", sa.DECIMAL(8, 2), nullable=False, server_default="0"),
        sa.Column("presentismo", sa.DECIMAL(12, 2), nullable=False, server_default="0"),
        sa.Column("premio", sa.DECIMAL(12, 2), nullable=False, server_default="0"),
        sa.Column("observaciones", sa.String(length=1000), nullable=True),
        sa.Column("documentos", postgresql.JSONB(astext_type=sa.Text()), nullable=True),
        sa.ForeignKeyConstraint(["tarja_id"], ["tarjas.id"]),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("tarja_id", name="uq_tarja_novedades_tarja"),
    )
    op.create_index("ix_tarja_novedades_tarja_id", "tarja_novedades", ["tarja_id"], unique=False)

def downgrade() -> None:
    op.drop_index("ix_tarja_novedades_tarja_id", table_name="tarja_novedades")
    op.drop_table("tarja_novedades")

    op.drop_index("ix_tarja_detalles_parte_diario_detalle_id", table_name="tarja_detalles")
    op.drop_index("ix_tarja_detalles_idestado", table_name="tarja_detalles")
    op.drop_index("ix_tarja_detalles_idnomina", table_name="tarja_detalles")
    op.drop_index("ix_tarja_detalles_tarja_id", table_name="tarja_detalles")
    op.drop_table("tarja_detalles")

    op.drop_table("tarjas")
