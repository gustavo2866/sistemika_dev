"""make_motivo_id_nullable_in_crm_eventos

Revision ID: 41ad8caf61de
Revises: 1044c4e955d7
Create Date: 2025-12-31 03:28:53.155961

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = '41ad8caf61de'
down_revision: Union[str, Sequence[str], None] = '1044c4e955d7'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Upgrade schema."""
    op.alter_column('crm_eventos', 'motivo_id',
                    existing_type=sa.Integer(),
                    nullable=True)


def downgrade() -> None:
    """Downgrade schema."""
    op.alter_column('crm_eventos', 'motivo_id',
                    existing_type=sa.Integer(),
                    nullable=False)
