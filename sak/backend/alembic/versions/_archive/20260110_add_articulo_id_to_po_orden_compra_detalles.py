"""Add articulo_id to po_orden_compra_detalles.

Revision ID: 20260110_add_articulo_id_to_po_orden_compra_detalles
Revises: 20260110_make_solicitud_detalle_id_optional
Create Date: 2026-01-10 18:00:00.000000

"""
from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision = "20260110_add_articulo_id_to_po_orden_compra_detalles"
down_revision = "20260110_make_solicitud_detalle_id_optional"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column(
        "po_orden_compra_detalles",
        sa.Column("articulo_id", sa.Integer(), nullable=True),
    )
    op.create_foreign_key(
        "fk_po_orden_compra_detalles_articulo",
        "po_orden_compra_detalles",
        "articulos",
        ["articulo_id"],
        ["id"],
    )


def downgrade() -> None:
    op.drop_constraint(
        "fk_po_orden_compra_detalles_articulo",
        "po_orden_compra_detalles",
        type_="foreignkey",
    )
    op.drop_column("po_orden_compra_detalles", "articulo_id")
