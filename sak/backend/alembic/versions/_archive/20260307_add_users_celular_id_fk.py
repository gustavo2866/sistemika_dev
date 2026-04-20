"""add_celular_id_fk_to_users

Revision ID: 20260307_add_users_celular_id_fk
Revises: 20260224_rename_fecha_ingreso_to_fecha_inicio_contrato
Create Date: 2026-03-07 12:45:00.000000

"""
from alembic import op
import sqlalchemy as sa

# revision identifiers, used by Alembic.
revision = "20260307_add_users_celular_id_fk"
down_revision = "20260224_rename_fecha_ingreso_to_fecha_inicio_contrato"
branch_labels = None
depends_on = None


def upgrade():
    op.add_column("users", sa.Column("celular_id", sa.Integer(), nullable=True))
    op.create_index(op.f("ix_users_celular_id"), "users", ["celular_id"], unique=False)
    op.create_foreign_key(
        "fk_users_celular_id",
        "users",
        "crm_celulares",
        ["celular_id"],
        ["id"],
    )


def downgrade():
    op.drop_constraint("fk_users_celular_id", "users", type_="foreignkey")
    op.drop_index(op.f("ix_users_celular_id"), table_name="users")
    op.drop_column("users", "celular_id")

