"""Drop solicitud_detalle_id from po_orden_compra_detalles.

Revision ID: 20260110_drop_solicitud_detalle_id_from_po_orden_compra_detalles
Revises: 20260110_add_articulo_id_to_po_orden_compra_detalles
Create Date: 2026-01-10 18:30:00.000000

"""
from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision = "20260110_drop_solicitud_detalle_id_from_po_orden_compra_detalles"
down_revision = "20260110_add_articulo_id_to_po_orden_compra_detalles"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.drop_constraint(
        "po_orden_compra_detalles_solicitud_detalle_id_fkey",
        "po_orden_compra_detalles",
        type_="foreignkey",
    )
    op.drop_column("po_orden_compra_detalles", "solicitud_detalle_id")


def downgrade() -> None:
    op.add_column(
        "po_orden_compra_detalles",
        sa.Column("solicitud_detalle_id", sa.Integer(), nullable=True),
    )
    op.create_foreign_key(
        "po_orden_compra_detalles_solicitud_detalle_id_fkey",
        "po_orden_compra_detalles",
        "po_solicitud_detalles",
        ["solicitud_detalle_id"],
        ["id"],
    )
