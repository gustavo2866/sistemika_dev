"""cash projection automatic default

Revision ID: 20261118_cash_manual_off
Revises: 20261118_cash_subcta_estado
Create Date: 2026-11-18 08:59:35.847967

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = '20261118_cash_manual_off'
down_revision: Union[str, Sequence[str], None] = '20261118_cash_subcta_estado'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Upgrade schema."""
    op.alter_column("erp_cash_proyectado", "origen_proyectado", existing_type=sa.String(15),
                    existing_nullable=False, server_default="CALCULADO")
    op.execute("""UPDATE erp_cash_proyectado
        SET origen_proyectado = 'CALCULADO', updated_at = CURRENT_TIMESTAMP, version = version + 1
        WHERE fecha_periodo >= DATE '2026-10-01'
          AND deleted_at IS NULL AND origen_proyectado = 'MANUAL'""")


def downgrade() -> None:
    """Downgrade schema."""
    # Los cambios de origen en datos existentes no se revierten automáticamente.
    op.alter_column("erp_cash_proyectado", "origen_proyectado", existing_type=sa.String(15),
                    existing_nullable=False, server_default="MANUAL")
