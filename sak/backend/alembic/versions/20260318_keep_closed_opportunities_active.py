"""Keep closed CRM opportunities active

Revision ID: 20260318_keep_closed_opportunities_active
Revises: 350c0f46a06c
Create Date: 2026-03-18 00:00:00.000000

"""

from typing import Sequence, Union

from alembic import op


# revision identifiers, used by Alembic.
revision: str = "20260318_keep_closed_opportunities_active"
down_revision: Union[str, Sequence[str], None] = "350c0f46a06c"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.execute(
        """
        UPDATE crm_oportunidades
        SET activo = true
        WHERE estado IN ('5-ganada', '6-perdida')
        """
    )


def downgrade() -> None:
    op.execute(
        """
        UPDATE crm_oportunidades
        SET activo = false
        WHERE estado IN ('5-ganada', '6-perdida')
        """
    )
