"""Add crm_tipos_contacto table and tipo_id to crm_contactos

Revision ID: 20260419_add_crm_tipos_contacto
Revises: 20260419_add_descripcion_to_contratos_archivos
Create Date: 2026-04-19 12:00:00.000000

"""
from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op

revision: str = "20260419_add_crm_tipos_contacto"
down_revision: Union[str, Sequence[str], None] = "20260419_add_descripcion_to_contratos_archivos"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # Crear tabla crm_tipos_contacto (con columnas de Base: created_at, updated_at, deleted_at, version)
    op.create_table(
        "crm_tipos_contacto",
        sa.Column("id", sa.Integer(), nullable=False),
        sa.Column("created_at", sa.DateTime(), nullable=False, server_default=sa.text("NOW()")),
        sa.Column("updated_at", sa.DateTime(), nullable=False, server_default=sa.text("NOW()")),
        sa.Column("deleted_at", sa.DateTime(), nullable=True),
        sa.Column("version", sa.Integer(), nullable=False, server_default="1"),
        sa.Column("nombre", sa.String(length=100), nullable=False),
        sa.Column("activo", sa.Boolean(), nullable=False, server_default="true"),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("nombre"),
    )
    op.create_index("ix_crm_tipos_contacto_nombre", "crm_tipos_contacto", ["nombre"])

    # Seed: datos iniciales
    op.execute(
        """
        INSERT INTO crm_tipos_contacto (nombre, activo) VALUES
            ('Inmobiliaria', true),
            ('Encargado', true),
            ('Propietario', true)
        """
    )

    # Agregar columna tipo_id a crm_contactos
    op.add_column(
        "crm_contactos",
        sa.Column("tipo_id", sa.Integer(), nullable=True),
    )
    op.create_foreign_key(
        "fk_crm_contactos_tipo_id",
        "crm_contactos",
        "crm_tipos_contacto",
        ["tipo_id"],
        ["id"],
    )
    op.create_index("ix_crm_contactos_tipo_id", "crm_contactos", ["tipo_id"])


def downgrade() -> None:
    op.drop_index("ix_crm_contactos_tipo_id", table_name="crm_contactos")
    op.drop_constraint("fk_crm_contactos_tipo_id", "crm_contactos", type_="foreignkey")
    op.drop_column("crm_contactos", "tipo_id")

    op.drop_index("ix_crm_tipos_contacto_nombre", table_name="crm_tipos_contacto")
    op.drop_table("crm_tipos_contacto")
