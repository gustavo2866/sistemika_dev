"""add_contacto_nombre_propuesto_and_oportunidad_generar_to_mensajes

Revision ID: e318dce771be
Revises: 4c2774dab77a
Create Date: 2025-11-29 16:24:51.628305

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = 'e318dce771be'
down_revision: Union[str, Sequence[str], None] = '4c2774dab77a'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Add oportunidad_generar column to crm_mensajes table if not exists."""
    # Check if columns exist, only add if they don't
    from sqlalchemy import inspect
    from alembic import op
    
    conn = op.get_bind()
    inspector = inspect(conn)
    columns = [col['name'] for col in inspector.get_columns('crm_mensajes')]
    
    # Add contacto_nombre_propuesto if it doesn't exist
    if 'contacto_nombre_propuesto' not in columns:
        op.add_column(
            'crm_mensajes',
            sa.Column('contacto_nombre_propuesto', sa.String(length=255), nullable=True)
        )
    
    # Add oportunidad_generar if it doesn't exist
    if 'oportunidad_generar' not in columns:
        op.add_column(
            'crm_mensajes',
            sa.Column('oportunidad_generar', sa.Boolean(), nullable=False, server_default='false')
        )


def downgrade() -> None:
    """Remove contacto_nombre_propuesto and oportunidad_generar columns from crm_mensajes table."""
    from sqlalchemy import inspect
    from alembic import op
    
    conn = op.get_bind()
    inspector = inspect(conn)
    columns = [col['name'] for col in inspector.get_columns('crm_mensajes')]
    
    if 'oportunidad_generar' in columns:
        op.drop_column('crm_mensajes', 'oportunidad_generar')
    if 'contacto_nombre_propuesto' in columns:
        op.drop_column('crm_mensajes', 'contacto_nombre_propuesto')
