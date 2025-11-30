"""Remove codigo column from tipos_propiedad

Revision ID: remove_codigo_tipos_prop
Revises: add_tipos_propiedad
Create Date: 2025-11-28 10:00:00.000000

"""
from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision = "remove_codigo_tipos_prop"
down_revision = "add_tipos_propiedad"
branch_labels = None
depends_on = None


def upgrade() -> None:
    with op.batch_alter_table("tipos_propiedad") as batch_op:
        batch_op.drop_index("ix_tipos_propiedad_codigo")
        batch_op.drop_column("codigo")


def downgrade() -> None:
    with op.batch_alter_table("tipos_propiedad") as batch_op:
        batch_op.add_column(sa.Column("codigo", sa.String(length=50), nullable=False))
        batch_op.create_index("ix_tipos_propiedad_codigo", ["codigo"], unique=True)

