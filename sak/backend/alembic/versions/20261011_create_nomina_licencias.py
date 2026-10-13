"""create nomina licencias table

Revision ID: 20261011_create_nomina_licencias
Revises: 20261004_unique_erp_cash_proyectado
Create Date: 2026-10-11
"""

from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op
from sqlalchemy.dialects import postgresql


revision: str = "20261011_create_nomina_licencias"
down_revision: Union[str, Sequence[str], None] = "20261004_create_erp_cash_periodos"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table(
        "nomina_licencias",
        sa.Column("id", sa.Integer(), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("deleted_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("version", sa.Integer(), nullable=False, server_default="1"),
        sa.Column("nomina_id", sa.Integer(), nullable=False),
        sa.Column("tipo_novedad", sa.String(length=10), nullable=False),
        sa.Column("fecha_desde", sa.Date(), nullable=False),
        sa.Column("fecha_hasta", sa.Date(), nullable=False),
        sa.Column("comentario", sa.String(length=2000), nullable=True),
        sa.Column("documentos", postgresql.JSONB(astext_type=sa.Text()), nullable=True),
        sa.ForeignKeyConstraint(["nomina_id"], ["nominas.id"]),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index("ix_nomina_licencias_nomina_id", "nomina_licencias", ["nomina_id"], unique=False)
    op.create_index("ix_nomina_licencias_tipo_novedad", "nomina_licencias", ["tipo_novedad"], unique=False)


def downgrade() -> None:
    op.drop_index("ix_nomina_licencias_tipo_novedad", table_name="nomina_licencias")
    op.drop_index("ix_nomina_licencias_nomina_id", table_name="nomina_licencias")
    op.drop_table("nomina_licencias")
