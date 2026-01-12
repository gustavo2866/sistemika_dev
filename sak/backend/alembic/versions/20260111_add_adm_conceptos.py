"""add_adm_conceptos_table

Revision ID: 20260111_add_adm_conceptos
Revises: 
Create Date: 2026-01-11 12:55:00.000000

"""
from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision = "20260111_add_adm_conceptos"
down_revision = None  # Will be set automatically
branch_labels = None
depends_on = None


def upgrade():
    """Create adm_conceptos table"""
    op.create_table(
        "adm_conceptos",
        sa.Column("id", sa.Integer(), nullable=False),
        sa.Column("nombre", sa.String(length=200), nullable=False),
        sa.Column("descripcion", sa.String(length=500), nullable=True),
        sa.Column("cuenta", sa.String(length=50), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
        sa.Column("deleted_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("version", sa.Integer(), server_default=sa.text('1'), nullable=False),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index("ix_adm_conceptos_nombre", "adm_conceptos", ["nombre"])
    op.create_index("ix_adm_conceptos_cuenta", "adm_conceptos", ["cuenta"])


def downgrade():
    """Drop adm_conceptos table"""
    op.drop_index("ix_adm_conceptos_cuenta", table_name="adm_conceptos")
    op.drop_index("ix_adm_conceptos_nombre", table_name="adm_conceptos")
    op.drop_table("adm_conceptos")