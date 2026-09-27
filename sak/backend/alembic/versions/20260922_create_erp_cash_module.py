"""create erp cash module tables

Revision ID: 20260922_create_erp_cash_module
Revises: 20260920_merge_tarja_heads
Create Date: 2026-09-22
"""

from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


revision: str = "20260922_create_erp_cash_module"
down_revision: Union[str, Sequence[str], None] = "20260920_merge_tarja_heads"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table(
        "erp_cash_cuentas",
        sa.Column("id", sa.Integer(), nullable=False),
        sa.Column("descripcion", sa.String(length=255), nullable=False),
        sa.Column("created_at", sa.DateTime(), nullable=False),
        sa.Column("updated_at", sa.DateTime(), nullable=False),
        sa.Column("deleted_at", sa.DateTime(), nullable=True),
        sa.Column("version", sa.Integer(), nullable=False),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("descripcion", name="uq_erp_cash_cuentas_descripcion"),
    )
    op.create_index("ix_erp_cash_cuentas_descripcion", "erp_cash_cuentas", ["descripcion"])

    op.create_table(
        "erp_cash_subctas",
        sa.Column("id", sa.Integer(), nullable=False),
        sa.Column("tpo_subcta", sa.Integer(), nullable=False),
        sa.Column("descripcion", sa.String(length=255), nullable=False),
        sa.Column("nro_subcta", sa.Integer(), nullable=False),
        sa.Column("categoria", sa.String(length=50), nullable=False),
        sa.Column("created_at", sa.DateTime(), nullable=False),
        sa.Column("updated_at", sa.DateTime(), nullable=False),
        sa.Column("deleted_at", sa.DateTime(), nullable=True),
        sa.Column("version", sa.Integer(), nullable=False),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("tpo_subcta", "nro_subcta", name="uq_erp_cash_subctas_tipo_numero"),
    )
    op.create_index("ix_erp_cash_subctas_tpo_subcta", "erp_cash_subctas", ["tpo_subcta"])
    op.create_index("ix_erp_cash_subctas_descripcion", "erp_cash_subctas", ["descripcion"])
    op.create_index("ix_erp_cash_subctas_nro_subcta", "erp_cash_subctas", ["nro_subcta"])
    op.create_index("ix_erp_cash_subctas_categoria", "erp_cash_subctas", ["categoria"])

    op.create_table(
        "erp_cash_map",
        sa.Column("id", sa.Integer(), nullable=False),
        sa.Column("nro_cta", sa.Integer(), nullable=False),
        sa.Column("moneda", sa.String(length=10), nullable=False),
        sa.Column("map_debe_id", sa.Integer(), nullable=False),
        sa.Column("map_haber_id", sa.Integer(), nullable=False),
        sa.Column("created_at", sa.DateTime(), nullable=False),
        sa.Column("updated_at", sa.DateTime(), nullable=False),
        sa.Column("deleted_at", sa.DateTime(), nullable=True),
        sa.Column("version", sa.Integer(), nullable=False),
        sa.ForeignKeyConstraint(["map_debe_id"], ["erp_cash_cuentas.id"]),
        sa.ForeignKeyConstraint(["map_haber_id"], ["erp_cash_cuentas.id"]),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("nro_cta", "moneda", name="uq_erp_cash_map_nro_cta_moneda"),
    )
    op.create_index("ix_erp_cash_map_nro_cta", "erp_cash_map", ["nro_cta"])
    op.create_index("ix_erp_cash_map_moneda", "erp_cash_map", ["moneda"])
    op.create_index("ix_erp_cash_map_map_debe_id", "erp_cash_map", ["map_debe_id"])
    op.create_index("ix_erp_cash_map_map_haber_id", "erp_cash_map", ["map_haber_id"])


def downgrade() -> None:
    op.drop_index("ix_erp_cash_map_map_haber_id", table_name="erp_cash_map")
    op.drop_index("ix_erp_cash_map_map_debe_id", table_name="erp_cash_map")
    op.drop_index("ix_erp_cash_map_moneda", table_name="erp_cash_map")
    op.drop_index("ix_erp_cash_map_nro_cta", table_name="erp_cash_map")
    op.drop_table("erp_cash_map")

    op.drop_index("ix_erp_cash_subctas_categoria", table_name="erp_cash_subctas")
    op.drop_index("ix_erp_cash_subctas_nro_subcta", table_name="erp_cash_subctas")
    op.drop_index("ix_erp_cash_subctas_descripcion", table_name="erp_cash_subctas")
    op.drop_index("ix_erp_cash_subctas_tpo_subcta", table_name="erp_cash_subctas")
    op.drop_table("erp_cash_subctas")

    op.drop_index("ix_erp_cash_cuentas_descripcion", table_name="erp_cash_cuentas")
    op.drop_table("erp_cash_cuentas")