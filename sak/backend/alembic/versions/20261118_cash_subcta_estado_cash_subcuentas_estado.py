"""cash subcuentas estado

Revision ID: 20261118_cash_subcta_estado
Revises: 20261114_cash_metodos_seed
Create Date: 2026-11-18 07:30:31.042938

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = '20261118_cash_subcta_estado'
down_revision: Union[str, Sequence[str], None] = '20261114_cash_metodos_seed'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Upgrade schema."""
    op.add_column("erp_cash_subctas", sa.Column("estado", sa.String(10), nullable=False, server_default="error"))
    op.alter_column("erp_cash_subctas", "categoria", existing_type=sa.String(50), nullable=True)
    op.execute("""UPDATE erp_cash_subctas
        SET estado = CASE WHEN categoria IS NULL OR trim(categoria) = '' OR lower(trim(categoria)) = 'error'
                          THEN 'error' ELSE 'activa' END,
            categoria = CASE WHEN categoria IS NULL OR trim(categoria) = '' OR lower(trim(categoria)) = 'error'
                             THEN NULL ELSE trim(categoria) END""")
    op.create_index("ix_erp_cash_subctas_estado", "erp_cash_subctas", ["estado"])
    op.create_check_constraint("ck_cash_subcta_estado", "erp_cash_subctas", "estado IN ('activa', 'error', 'bloqueada')")
    op.create_check_constraint("ck_cash_subcta_activa_categoria", "erp_cash_subctas", "estado <> 'activa' OR (categoria IS NOT NULL AND trim(categoria) <> '' AND lower(trim(categoria)) <> 'error')")
    op.alter_column("erp_cash_subctas", "estado", server_default=None)


def downgrade() -> None:
    """Downgrade schema."""
    op.drop_constraint("ck_cash_subcta_activa_categoria", "erp_cash_subctas", type_="check")
    op.drop_constraint("ck_cash_subcta_estado", "erp_cash_subctas", type_="check")
    op.execute("UPDATE erp_cash_subctas SET categoria = 'ERROR' WHERE categoria IS NULL OR trim(categoria) = ''")
    op.alter_column("erp_cash_subctas", "categoria", existing_type=sa.String(50), nullable=False)
    op.drop_index("ix_erp_cash_subctas_estado", table_name="erp_cash_subctas")
    op.drop_column("erp_cash_subctas", "estado")
