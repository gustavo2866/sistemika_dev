"""add_fecha_mensaje_to_crm_mensajes

Revision ID: d91b670bedfd
Revises: 7ce9174d43c8
Create Date: 2025-11-24 16:39:41.790574

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = 'd91b670bedfd'
down_revision: Union[str, Sequence[str], None] = '7ce9174d43c8'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Add fecha_mensaje column to crm_mensajes table."""
    # Add column as nullable first
    op.add_column(
        "crm_mensajes",
        sa.Column("fecha_mensaje", sa.DateTime(timezone=True), nullable=True),
    )
    
    # Populate with created_at for existing records
    op.execute(
        "UPDATE crm_mensajes SET fecha_mensaje = created_at WHERE fecha_mensaje IS NULL"
    )
    
    # Make it non-nullable
    op.alter_column("crm_mensajes", "fecha_mensaje", nullable=False)
    
    # Add index
    op.create_index(
        "ix_crm_mensajes_fecha_mensaje",
        "crm_mensajes",
        ["fecha_mensaje"],
        unique=False,
    )


def downgrade() -> None:
    """Remove fecha_mensaje column from crm_mensajes table."""
    op.drop_index("ix_crm_mensajes_fecha_mensaje", table_name="crm_mensajes")
    op.drop_column("crm_mensajes", "fecha_mensaje")
