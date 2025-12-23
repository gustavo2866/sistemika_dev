"""Remove responsable_id from emprendimientos

Revision ID: cd91a1abf4f0
Revises: 5d0d351a82c7
Create Date: 2025-12-20
"""

from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa

# revision identifiers, used by Alembic.
revision: str = "cd91a1abf4f0"
down_revision: Union[str, Sequence[str], None] = "5d0d351a82c7"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    bind = op.get_bind()
    if bind.dialect.name == "postgresql":
        op.execute(
            "ALTER TABLE emprendimientos DROP CONSTRAINT IF EXISTS emprendimientos_responsable_id_fkey"
        )
        op.execute("ALTER TABLE emprendimientos DROP COLUMN IF EXISTS responsable_id")
        return

    with op.batch_alter_table("emprendimientos") as batch_op:
        batch_op.drop_constraint("emprendimientos_responsable_id_fkey", type_="foreignkey")
        batch_op.drop_column("responsable_id")


def downgrade() -> None:
    with op.batch_alter_table("emprendimientos") as batch_op:
        batch_op.add_column(sa.Column("responsable_id", sa.Integer(), nullable=True))
        batch_op.create_foreign_key(
            "emprendimientos_responsable_id_fkey",
            "users",
            ["responsable_id"],
            ["id"],
        )
