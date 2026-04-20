"""add_deleted_at_version_to_adm_conceptos

Revision ID: b433f4a6e37b
Revises: 1bd2425fecd5
Create Date: 2026-01-11 12:57:39.218833

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = 'b433f4a6e37b'
down_revision: Union[str, Sequence[str], None] = '1bd2425fecd5'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Add deleted_at and version columns to adm_conceptos table"""
    op.add_column('adm_conceptos', sa.Column('deleted_at', sa.DateTime(timezone=True), nullable=True))
    op.add_column('adm_conceptos', sa.Column('version', sa.Integer(), server_default=sa.text('1'), nullable=False))


def downgrade() -> None:
    """Remove deleted_at and version columns from adm_conceptos table"""
    op.drop_column('adm_conceptos', 'version')
    op.drop_column('adm_conceptos', 'deleted_at')
