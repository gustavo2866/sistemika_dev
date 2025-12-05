"""add_titulo_and_forma_pago_descripcion_to_oportunidades

Revision ID: de2846bac742
Revises: 3fe6ede299ac
Create Date: 2025-12-04 22:07:15.102496

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = 'de2846bac742'
down_revision: Union[str, Sequence[str], None] = '3fe6ede299ac'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Upgrade schema."""
    # Add titulo column
    op.add_column('crm_oportunidades', sa.Column('titulo', sa.String(length=100), nullable=True))
    
    # Add forma_pago_descripcion column
    op.add_column('crm_oportunidades', sa.Column('forma_pago_descripcion', sa.String(length=500), nullable=True))


def downgrade() -> None:
    """Downgrade schema."""
    # Remove columns
    op.drop_column('crm_oportunidades', 'forma_pago_descripcion')
    op.drop_column('crm_oportunidades', 'titulo')
