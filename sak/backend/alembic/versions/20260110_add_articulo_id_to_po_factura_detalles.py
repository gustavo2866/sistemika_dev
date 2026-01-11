"""Add articulo_id to po_factura_detalles and drop orden_compra_detalle_id.

Revision ID: 20260110_add_articulo_id_to_po_factura_detalles
Revises: 20260110_drop_solicitud_detalle_id_from_po_orden_compra_detalles
Create Date: 2026-01-10 19:10:00.000000

"""
from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision = "20260110_add_articulo_id_to_po_factura_detalles"
down_revision = "20260110_drop_solicitud_detalle_id_from_po_orden_compra_detalles"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column(
        "po_factura_detalles",
        sa.Column("articulo_id", sa.Integer(), nullable=True),
    )
    op.create_foreign_key(
        "fk_po_factura_detalles_articulo",
        "po_factura_detalles",
        "articulos",
        ["articulo_id"],
        ["id"],
    )
    op.drop_constraint(
        "po_factura_detalles_orden_compra_detalle_id_fkey",
        "po_factura_detalles",
        type_="foreignkey",
    )
    op.drop_column("po_factura_detalles", "orden_compra_detalle_id")


def downgrade() -> None:
    op.add_column(
        "po_factura_detalles",
        sa.Column("orden_compra_detalle_id", sa.Integer(), nullable=True),
    )
    op.create_foreign_key(
        "po_factura_detalles_orden_compra_detalle_id_fkey",
        "po_factura_detalles",
        "po_orden_compra_detalles",
        ["orden_compra_detalle_id"],
        ["id"],
    )
    op.drop_constraint(
        "fk_po_factura_detalles_articulo",
        "po_factura_detalles",
        type_="foreignkey",
    )
    op.drop_column("po_factura_detalles", "articulo_id")
