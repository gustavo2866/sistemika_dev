"""Add po_factura_totales table.

Revision ID: 20260112_add_po_factura_totales
Revises: 20260111_add_adm_concepto_to_tipos_articulo
Create Date: 2026-01-12 00:00:00.000000

"""
from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision = "20260112_add_po_factura_totales"
down_revision = "20260111_add_adm_concepto_to_tipos_articulo"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        "po_factura_totales",
        sa.Column("id", sa.Integer(), nullable=False),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            server_default=sa.text("now()"),
            nullable=False,
        ),
        sa.Column(
            "updated_at",
            sa.DateTime(timezone=True),
            server_default=sa.text("now()"),
            nullable=False,
        ),
        sa.Column("deleted_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("version", sa.Integer(), server_default="1", nullable=False),
        sa.Column("factura_id", sa.Integer(), nullable=False),
        sa.Column("concepto_id", sa.Integer(), nullable=False),
        sa.Column("centro_costo_id", sa.Integer(), nullable=True),
        sa.Column("tipo", sa.String(length=20), nullable=False),
        sa.Column("descripcion", sa.String(length=50), nullable=True),
        sa.Column("importe", sa.DECIMAL(precision=15, scale=2), nullable=False),
        sa.ForeignKeyConstraint(["factura_id"], ["po_facturas.id"]),
        sa.ForeignKeyConstraint(["concepto_id"], ["adm_conceptos.id"]),
        sa.ForeignKeyConstraint(["centro_costo_id"], ["centros_costo.id"]),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index(
        "ix_po_factura_totales_factura_id",
        "po_factura_totales",
        ["factura_id"],
    )
    op.create_index(
        "ix_po_factura_totales_concepto_id",
        "po_factura_totales",
        ["concepto_id"],
    )
    op.create_index(
        "ix_po_factura_totales_centro_costo_id",
        "po_factura_totales",
        ["centro_costo_id"],
    )
    op.create_index(
        "ix_po_factura_totales_tipo",
        "po_factura_totales",
        ["tipo"],
    )
    op.create_unique_constraint(
        "uq_po_factura_totales_factura_tipo_concepto_centro",
        "po_factura_totales",
        ["factura_id", "tipo", "concepto_id", "centro_costo_id"],
    )


def downgrade() -> None:
    op.drop_constraint(
        "uq_po_factura_totales_factura_tipo_concepto_centro",
        "po_factura_totales",
        type_="unique",
    )
    op.drop_index("ix_po_factura_totales_tipo", table_name="po_factura_totales")
    op.drop_index("ix_po_factura_totales_centro_costo_id", table_name="po_factura_totales")
    op.drop_index("ix_po_factura_totales_concepto_id", table_name="po_factura_totales")
    op.drop_index("ix_po_factura_totales_factura_id", table_name="po_factura_totales")
    op.drop_table("po_factura_totales")
