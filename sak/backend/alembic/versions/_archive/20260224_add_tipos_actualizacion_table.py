"""add_tipos_actualizacion_table

Revision ID: 20260224_add_tipos_actualizacion_table
Revises: 20260224_add_propietarios_table
Create Date: 2026-02-24 20:00:00.000000

"""
from alembic import op
import sqlalchemy as sa

# revision identifiers, used by Alembic.
revision = "20260224_add_tipos_actualizacion_table"
down_revision = "20260224_add_propietarios_table"
branch_labels = None
depends_on = None


def upgrade():
    """Create tipos_actualizacion table"""
    op.create_table(
        "tipos_actualizacion",
        sa.Column("id", sa.Integer(), nullable=False),
        sa.Column("nombre", sa.String(length=100), nullable=False),
        sa.Column("cantidad_meses", sa.Integer(), nullable=False),
        sa.Column("activa", sa.Boolean(), nullable=False, server_default=sa.text("true")),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
        sa.Column("deleted_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("version", sa.Integer(), server_default=sa.text('1'), nullable=False),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("nombre"),
    )
    op.create_index("ix_tipos_actualizacion_nombre", "tipos_actualizacion", ["nombre"])


def downgrade():
    """Drop tipos_actualizacion table"""
    op.drop_index("ix_tipos_actualizacion_nombre", table_name="tipos_actualizacion")
    op.drop_table("tipos_actualizacion")