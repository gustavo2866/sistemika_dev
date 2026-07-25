"""create erp cuenta tipos table

Revision ID: 20260722_create_erp_cuenta_tipos
Revises: 20260722_create_erp_presupuestos
Create Date: 2026-07-22
"""

from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


revision: str = "20260722_create_erp_cuenta_tipos"
down_revision: Union[str, Sequence[str], None] = "20260722_create_erp_presupuestos"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table(
        "erp_cuenta_tipos",
        sa.Column("id", sa.Integer(), nullable=False),
        sa.Column("nombre", sa.String(length=200), nullable=False),
        sa.Column("descripcion", sa.String(length=500), nullable=True),
        sa.Column("cuenta", sa.String(length=50), nullable=False),
        sa.Column("es_impuesto", sa.Boolean(), nullable=False, server_default="0"),
        sa.Column("created_at", sa.DateTime(), nullable=False),
        sa.Column("updated_at", sa.DateTime(), nullable=False),
        sa.Column("deleted_at", sa.DateTime(), nullable=True),
        sa.Column("version", sa.Integer(), nullable=False),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index("ix_erp_cuenta_tipos_nombre", "erp_cuenta_tipos", ["nombre"])
    op.create_index("ix_erp_cuenta_tipos_cuenta", "erp_cuenta_tipos", ["cuenta"])
    op.create_index("ix_erp_cuenta_tipos_es_impuesto", "erp_cuenta_tipos", ["es_impuesto"])

    op.execute(
        """
        INSERT INTO erp_cuenta_tipos (nombre, descripcion, cuenta, es_impuesto, created_at, updated_at, version)
        SELECT nombre, descripcion, cuenta, es_impuesto, NOW(), NOW(), 1
        FROM adm_conceptos
        WHERE deleted_at IS NULL
        ORDER BY id
        """
    )


def downgrade() -> None:
    op.drop_index("ix_erp_cuenta_tipos_es_impuesto", table_name="erp_cuenta_tipos")
    op.drop_index("ix_erp_cuenta_tipos_cuenta", table_name="erp_cuenta_tipos")
    op.drop_index("ix_erp_cuenta_tipos_nombre", table_name="erp_cuenta_tipos")
    op.drop_table("erp_cuenta_tipos")
