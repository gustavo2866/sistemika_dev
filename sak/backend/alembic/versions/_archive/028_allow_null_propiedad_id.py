"""Allow NULL in crm_oportunidades.propiedad_id

Revision ID: 028_allow_null_propiedad_id
Revises: 027_create_webhook_logs
Create Date: 2025-12-19 10:45:00.000000
"""

from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = "028_allow_null_propiedad_id"
down_revision: Union[str, Sequence[str], None] = "027_create_webhook_logs"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Make propiedad_id nullable so oportunidades can be creadas sin propiedad."""
    op.alter_column(
        "crm_oportunidades",
        "propiedad_id",
        existing_type=sa.INTEGER(),
        nullable=True,
    )


def downgrade() -> None:
    """Revert columna a NOT NULL (puede fallar si hay registros con NULL)."""
    op.alter_column(
        "crm_oportunidades",
        "propiedad_id",
        existing_type=sa.INTEGER(),
        nullable=False,
    )
