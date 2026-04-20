"""Add solicitud_detalle_id to po_orden_compra_detalles.

Revision ID: 20260206_add_solicitud_id_to_po_orden_compra_detalles
Revises: 20260130_update_po_solicitudes_estados
Create Date: 2026-02-06 00:00:00.000000

"""
from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision = "20260206_add_solicitud_id_to_po_orden_compra_detalles"
down_revision = ("20260130_update_po_solicitudes_estados", "cea3112b5aaf")
branch_labels = None
depends_on = None


def upgrade() -> None:
    """Add optional solicitud_detalle_id FK to po_orden_compra_detalles."""
    # Add the solicitud_detalle_id column as nullable
    op.add_column(
        "po_orden_compra_detalles",
        sa.Column("solicitud_detalle_id", sa.Integer(), nullable=True),
    )
    
    # Create foreign key constraint
    op.create_foreign_key(
        "fk_po_orden_compra_detalles_solicitud_detalle",
        "po_orden_compra_detalles",
        "po_solicitud_detalles",
        ["solicitud_detalle_id"],
        ["id"],
    )
    
    # Create index for better query performance
    op.create_index(
        "ix_po_orden_compra_detalles_solicitud_detalle_id",
        "po_orden_compra_detalles",
        ["solicitud_detalle_id"],
        unique=False,
    )


def downgrade() -> None:
    """Remove solicitud_detalle_id FK from po_orden_compra_detalles."""
    # Drop index first
    op.drop_index("ix_po_orden_compra_detalles_solicitud_detalle_id", table_name="po_orden_compra_detalles")
    
    # Drop foreign key constraint
    op.drop_constraint(
        "fk_po_orden_compra_detalles_solicitud_detalle",
        "po_orden_compra_detalles",
        type_="foreignkey",
    )
    
    # Drop the column
    op.drop_column("po_orden_compra_detalles", "solicitud_detalle_id")