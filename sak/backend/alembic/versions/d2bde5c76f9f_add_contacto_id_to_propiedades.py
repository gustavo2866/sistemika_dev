"""add_contacto_id_to_propiedades

Revision ID: d2bde5c76f9f
Revises: 41ad8caf61de
Create Date: 2025-12-31 05:01:31.887003

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = 'd2bde5c76f9f'
down_revision: Union[str, Sequence[str], None] = '41ad8caf61de'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Upgrade schema."""
    op.add_column('propiedades', sa.Column('contacto_id', sa.Integer(), nullable=True))
    op.create_index(op.f('ix_propiedades_contacto_id'), 'propiedades', ['contacto_id'], unique=False)
    op.create_foreign_key('fk_propiedades_contacto_id', 'propiedades', 'crm_contactos', ['contacto_id'], ['id'])


def downgrade() -> None:
    """Downgrade schema."""
    op.drop_constraint('fk_propiedades_contacto_id', 'propiedades', type_='foreignkey')
    op.drop_index(op.f('ix_propiedades_contacto_id'), table_name='propiedades')
    op.drop_column('propiedades', 'contacto_id')
