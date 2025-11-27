"""rename_estado_alquilada_to_realizada

Revision ID: 474a0baead68
Revises: f8c734a461d2
Create Date: 2025-11-27 07:51:39.929745

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = '474a0baead68'
down_revision: Union[str, Sequence[str], None] = 'f8c734a461d2'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Upgrade schema - Renombrar estado 4-alquilada a 4-realizada."""
    # Actualizar registros existentes en la tabla propiedades
    op.execute("""
        UPDATE propiedades 
        SET estado = '4-realizada' 
        WHERE estado = '4-alquilada'
    """)
    
    # Actualizar el comentario de estado_comentario si menciona migración de 'alquilada'
    op.execute("""
        UPDATE propiedades 
        SET estado_comentario = REPLACE(estado_comentario, 'alquilada', 'realizada')
        WHERE estado_comentario LIKE '%alquilada%'
    """)


def downgrade() -> None:
    """Downgrade schema - Revertir el cambio de nombre."""
    # Revertir el cambio de estado
    op.execute("""
        UPDATE propiedades 
        SET estado = '4-alquilada' 
        WHERE estado = '4-realizada'
    """)
    
    # Revertir el cambio en comentarios
    op.execute("""
        UPDATE propiedades 
        SET estado_comentario = REPLACE(estado_comentario, 'realizada', 'alquilada')
        WHERE estado_comentario LIKE '%realizada%'
    """)
