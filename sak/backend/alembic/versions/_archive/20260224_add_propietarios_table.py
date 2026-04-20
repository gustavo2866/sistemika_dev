"""add_propietarios_table

Revision ID: 20260224_add_propietarios_table
Revises: 062a1eaf2e0d
Create Date: 2026-02-24 19:40:00.000000

"""
from alembic import op
import sqlalchemy as sa

# revision identifiers, used by Alembic.
revision = "20260224_add_propietarios_table"
down_revision = "062a1eaf2e0d"
branch_labels = None
depends_on = None


def upgrade():
    """Create propietarios table"""
    op.create_table(
        "propietarios",
        sa.Column("id", sa.Integer(), nullable=False),
        sa.Column("nombre", sa.String(length=200), nullable=False),
        sa.Column("adm_concepto_id", sa.Integer(), nullable=True),
        sa.Column("centro_costo_id", sa.Integer(), nullable=True),
        sa.Column("comentario", sa.String(length=1000), nullable=True),
        sa.Column("activo", sa.Boolean(), nullable=False, server_default=sa.text("true")),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
        sa.Column("deleted_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("version", sa.Integer(), server_default=sa.text('1'), nullable=False),
        sa.PrimaryKeyConstraint("id"),
        sa.ForeignKeyConstraint(["adm_concepto_id"], ["adm_conceptos.id"]),
        sa.ForeignKeyConstraint(["centro_costo_id"], ["centros_costo.id"]),
    )
    op.create_index("ix_propietarios_nombre", "propietarios", ["nombre"])


def downgrade():
    """Drop propietarios table"""
    op.drop_index("ix_propietarios_nombre", table_name="propietarios")
    op.drop_table("propietarios")