"""Crear tablas tipos_contrato, contratos y contratos_archivos

Revision ID: 20260411_contratos
Revises: 20260324_112400_add_responsable_id_fk_to_proyecto
Create Date: 2026-04-11

"""
from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op
from sqlalchemy.dialects.postgresql import JSONB

revision: str = "20260411_contratos"
down_revision: Union[str, Sequence[str], None] = "a1b2c3d4e5f6"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # --- tipos_contrato ---
    op.create_table(
        "tipos_contrato",
        sa.Column("id", sa.Integer(), nullable=False),
        sa.Column("nombre", sa.String(120), nullable=False),
        sa.Column("descripcion", sa.String(500), nullable=True),
        sa.Column("activo", sa.Boolean(), nullable=False, server_default="true"),
        sa.Column("template", JSONB(), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("deleted_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("version", sa.Integer(), nullable=False, server_default="1"),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("nombre"),
    )
    op.create_index("ix_tipos_contrato_nombre", "tipos_contrato", ["nombre"])

    # --- contratos ---
    op.create_table(
        "contratos",
        sa.Column("id", sa.Integer(), nullable=False),
        sa.Column("propiedad_id", sa.Integer(), nullable=False),
        sa.Column("tipo_contrato_id", sa.Integer(), nullable=True),
        sa.Column("tipo_actualizacion_id", sa.Integer(), nullable=True),
        # Vigencia
        sa.Column("fecha_inicio", sa.Date(), nullable=False),
        sa.Column("fecha_vencimiento", sa.Date(), nullable=False),
        sa.Column("fecha_renovacion", sa.Date(), nullable=True),
        sa.Column("duracion_meses", sa.Integer(), nullable=True),
        # Económico
        sa.Column("valor_alquiler", sa.Float(), nullable=False),
        sa.Column("expensas", sa.Float(), nullable=True),
        sa.Column("deposito_garantia", sa.Float(), nullable=True),
        sa.Column("moneda", sa.String(10), nullable=False, server_default="ARS"),
        # Inquilino
        sa.Column("inquilino_nombre", sa.String(200), nullable=False),
        sa.Column("inquilino_apellido", sa.String(200), nullable=False),
        sa.Column("inquilino_dni", sa.String(20), nullable=True),
        sa.Column("inquilino_cuit", sa.String(20), nullable=True),
        sa.Column("inquilino_email", sa.String(200), nullable=True),
        sa.Column("inquilino_telefono", sa.String(50), nullable=True),
        sa.Column("inquilino_domicilio", sa.String(300), nullable=True),
        # Garante 1
        sa.Column("garante1_nombre", sa.String(200), nullable=True),
        sa.Column("garante1_apellido", sa.String(200), nullable=True),
        sa.Column("garante1_dni", sa.String(20), nullable=True),
        sa.Column("garante1_cuit", sa.String(20), nullable=True),
        sa.Column("garante1_email", sa.String(200), nullable=True),
        sa.Column("garante1_telefono", sa.String(50), nullable=True),
        sa.Column("garante1_domicilio", sa.String(300), nullable=True),
        sa.Column("garante1_tipo_garantia", sa.String(100), nullable=True),
        # Garante 2
        sa.Column("garante2_nombre", sa.String(200), nullable=True),
        sa.Column("garante2_apellido", sa.String(200), nullable=True),
        sa.Column("garante2_dni", sa.String(20), nullable=True),
        sa.Column("garante2_cuit", sa.String(20), nullable=True),
        sa.Column("garante2_email", sa.String(200), nullable=True),
        sa.Column("garante2_telefono", sa.String(50), nullable=True),
        sa.Column("garante2_domicilio", sa.String(300), nullable=True),
        sa.Column("garante2_tipo_garantia", sa.String(100), nullable=True),
        # Estado
        sa.Column("estado", sa.String(50), nullable=False, server_default="borrador"),
        sa.Column("fecha_rescision", sa.Date(), nullable=True),
        sa.Column("motivo_rescision", sa.String(300), nullable=True),
        sa.Column("contrato_renovado_id", sa.Integer(), nullable=True),
        sa.Column("observaciones", sa.Text(), nullable=True),
        # Timestamps
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("deleted_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("version", sa.Integer(), nullable=False, server_default="1"),
        sa.PrimaryKeyConstraint("id"),
        sa.ForeignKeyConstraint(["propiedad_id"], ["propiedades.id"], name="fk_contratos_propiedad_id"),
        sa.ForeignKeyConstraint(["tipo_contrato_id"], ["tipos_contrato.id"], name="fk_contratos_tipo_contrato_id"),
        sa.ForeignKeyConstraint(["tipo_actualizacion_id"], ["tipos_actualizacion.id"], name="fk_contratos_tipo_actualizacion_id"),
        sa.ForeignKeyConstraint(["contrato_renovado_id"], ["contratos.id"], name="fk_contratos_contrato_renovado_id"),
    )
    op.create_index("ix_contratos_propiedad_id", "contratos", ["propiedad_id"])
    op.create_index("ix_contratos_tipo_contrato_id", "contratos", ["tipo_contrato_id"])
    op.create_index("ix_contratos_estado", "contratos", ["estado"])
    op.create_index("ix_contratos_fecha_vencimiento", "contratos", ["fecha_vencimiento"])
    op.create_index("ix_contratos_propiedad_estado", "contratos", ["propiedad_id", "estado"])

    # --- contratos_archivos ---
    op.create_table(
        "contratos_archivos",
        sa.Column("id", sa.Integer(), nullable=False),
        sa.Column("contrato_id", sa.Integer(), nullable=False),
        sa.Column("nombre", sa.String(300), nullable=False),
        sa.Column("tipo", sa.String(100), nullable=True),
        sa.Column("archivo_url", sa.String(500), nullable=False),
        sa.Column("mime_type", sa.String(100), nullable=True),
        sa.Column("tamanio_bytes", sa.Integer(), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("deleted_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("version", sa.Integer(), nullable=False, server_default="1"),
        sa.PrimaryKeyConstraint("id"),
        sa.ForeignKeyConstraint(["contrato_id"], ["contratos.id"], name="fk_contratos_archivos_contrato_id"),
    )
    op.create_index("ix_contratos_archivos_contrato_id", "contratos_archivos", ["contrato_id"])


def downgrade() -> None:
    op.drop_table("contratos_archivos")
    op.drop_table("contratos")
    op.drop_table("tipos_contrato")
