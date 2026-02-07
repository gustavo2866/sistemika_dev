"""Rename solicitud_id to solicitud_detalle_id and update FK target.

Revision ID: 20260206_fix_solicitud_detalle_fk
Revises: 20260206_add_solicitud_id_to_po_orden_compra_detalles
Create Date: 2026-02-06 01:00:00.000000

"""
from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision = "20260206_fix_solicitud_detalle_fk"
down_revision = "20260206_add_solicitud_id_to_po_orden_compra_detalles"
branch_labels = None
depends_on = None


def upgrade() -> None:
    """Fix FK naming and target to point to po_solicitud_detalles."""
    
    # Drop existing constraints and index
    op.drop_constraint(
        "fk_po_orden_compra_detalles_solicitud",
        "po_orden_compra_detalles",
        type_="foreignkey",
    )
    op.drop_index("ix_po_orden_compra_detalles_solicitud_id", table_name="po_orden_compra_detalles")
    
    # Rename column to follow proper naming pattern
    op.alter_column(
        "po_orden_compra_detalles",
        "solicitud_id",
        new_column_name="solicitud_detalle_id"
    )
    
    # Create new FK constraint pointing to po_solicitud_detalles
    op.create_foreign_key(
        "fk_po_orden_compra_detalles_solicitud_detalle",
        "po_orden_compra_detalles",
        "po_solicitud_detalles",
        ["solicitud_detalle_id"],
        ["id"],
    )
    
    # Create new index
    op.create_index(
        "ix_po_orden_compra_detalles_solicitud_detalle_id",
        "po_orden_compra_detalles",
        ["solicitud_detalle_id"],
        unique=False,
    )


def downgrade() -> None:
    """Revert FK naming and target back to po_solicitudes."""
    
    # Drop new constraints and index
    op.drop_constraint(
        "fk_po_orden_compra_detalles_solicitud_detalle",
        "po_orden_compra_detalles",
        type_="foreignkey",
    )
    op.drop_index("ix_po_orden_compra_detalles_solicitud_detalle_id", table_name="po_orden_compra_detalles")
    
    # Rename column back
    op.alter_column(
        "po_orden_compra_detalles",
        "solicitud_detalle_id",
        new_column_name="solicitud_id"
    )
    
    # Recreate old FK constraint
    op.create_foreign_key(
        "fk_po_orden_compra_detalles_solicitud",
        "po_orden_compra_detalles",
        "po_solicitudes",
        ["solicitud_id"],
        ["id"],
    )
    
    # Recreate old index
    op.create_index(
        "ix_po_orden_compra_detalles_solicitud_id",
        "po_orden_compra_detalles",
        ["solicitud_id"],
        unique=False,
    )