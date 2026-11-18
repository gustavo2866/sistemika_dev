"""clear automatic cash projection descriptions

Revision ID: 20261118_cash_clear_auto
Revises: 20261118_cash_manual_off
Create Date: 2026-11-18 09:08:37.375287

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = '20261118_cash_clear_auto'
down_revision: Union[str, Sequence[str], None] = '20261118_cash_manual_off'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Upgrade schema."""
    op.execute("""UPDATE erp_cash_proyectado
        SET observacion = NULL, updated_at = CURRENT_TIMESTAMP, version = version + 1
        WHERE ltrim(observacion) ILIKE 'AUTO:%'""")


def downgrade() -> None:
    """Downgrade schema."""
    # No reconstruir descripciones automáticas eliminadas.
    pass
