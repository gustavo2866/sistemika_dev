"""Make propiedad_id nullable and add descripcion to oportunidades

Revision ID: 2025011201
Revises: 7ce9174d43c8
Create Date: 2025-01-12 10:00:00.000000
"""

from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = "2025011201"
down_revision: Union[str, None] = "7ce9174d43c8"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.alter_column(
        "crm_oportunidades",
        "propiedad_id",
        existing_type=sa.INTEGER(),
        nullable=True,
    )
    op.add_column(
        "crm_oportunidades",
        sa.Column("descripcion", sa.String(length=1000), nullable=True),
    )


def downgrade() -> None:
    op.drop_column("crm_oportunidades", "descripcion")
    op.alter_column(
        "crm_oportunidades",
        "propiedad_id",
        existing_type=sa.INTEGER(),
        nullable=False,
    )
