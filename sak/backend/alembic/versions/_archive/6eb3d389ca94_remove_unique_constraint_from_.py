"""Remove unique constraint from propiedades.nombre

Revision ID: 6eb3d389ca94
Revises: 20260219_add_vacancia_fields_to_propiedades
Create Date: 2026-02-19 09:00:13.472416

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = '6eb3d389ca94'
down_revision: Union[str, Sequence[str], None] = '20260219_add_vacancia_fields_to_propiedades'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Remove unique constraint from propiedades.nombre if it exists."""
    # Check if unique constraint exists before trying to drop it
    from sqlalchemy import text
    connection = op.get_bind()
    
    # Check if the constraint exists
    result = connection.execute(text("""
        SELECT conname 
        FROM pg_constraint 
        WHERE conrelid = (SELECT oid FROM pg_class WHERE relname = 'propiedades') 
        AND contype = 'u' 
        AND conname LIKE '%nombre%'
    """)).fetchall()
    
    if result:
        constraint_name = result[0][0]
        print(f"Dropping unique constraint: {constraint_name}")
        op.drop_constraint(constraint_name, 'propiedades', type_='unique')
    else:
        print("No unique constraint found on nombre column - nothing to drop")


def downgrade() -> None:
    """Restore unique constraint on propiedades.nombre."""
    # Add back unique constraint on nombre column  
    op.create_unique_constraint('propiedades_nombre_key', 'propiedades', ['nombre'])
