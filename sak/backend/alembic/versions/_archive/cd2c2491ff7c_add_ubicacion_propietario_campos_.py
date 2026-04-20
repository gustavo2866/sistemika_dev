"""add_ubicacion_propietario_campos_contrato

Revision ID: cd2c2491ff7c
Revises: 4d781a7c99cd
Create Date: 2026-04-12 09:04:01.021664

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = 'cd2c2491ff7c'
down_revision: Union[str, Sequence[str], None] = '4d781a7c99cd'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Upgrade schema."""
    # --- propiedades: campos de ubicación del inmueble ---
    op.execute("""
        ALTER TABLE propiedades
            ADD COLUMN IF NOT EXISTS domicilio VARCHAR(500),
            ADD COLUMN IF NOT EXISTS localidad VARCHAR(200),
            ADD COLUMN IF NOT EXISTS provincia VARCHAR(100),
            ADD COLUMN IF NOT EXISTS codigo_postal VARCHAR(20),
            ADD COLUMN IF NOT EXISTS matricula_catastral VARCHAR(200)
    """)

    # --- propietarios: datos identificatorios y de contacto ---
    op.execute("""
        ALTER TABLE propietarios
            ADD COLUMN IF NOT EXISTS dni VARCHAR(20),
            ADD COLUMN IF NOT EXISTS cuit VARCHAR(20),
            ADD COLUMN IF NOT EXISTS tipo_persona VARCHAR(20),
            ADD COLUMN IF NOT EXISTS domicilio VARCHAR(500),
            ADD COLUMN IF NOT EXISTS localidad VARCHAR(200),
            ADD COLUMN IF NOT EXISTS provincia VARCHAR(100),
            ADD COLUMN IF NOT EXISTS email VARCHAR(200),
            ADD COLUMN IF NOT EXISTS telefono VARCHAR(50)
    """)


def downgrade() -> None:
    """Downgrade schema."""
    op.execute("""
        ALTER TABLE propietarios
            DROP COLUMN IF EXISTS telefono,
            DROP COLUMN IF EXISTS email,
            DROP COLUMN IF EXISTS provincia,
            DROP COLUMN IF EXISTS localidad,
            DROP COLUMN IF EXISTS domicilio,
            DROP COLUMN IF EXISTS tipo_persona,
            DROP COLUMN IF EXISTS cuit,
            DROP COLUMN IF EXISTS dni
    """)
    op.execute("""
        ALTER TABLE propiedades
            DROP COLUMN IF EXISTS matricula_catastral,
            DROP COLUMN IF EXISTS codigo_postal,
            DROP COLUMN IF EXISTS provincia,
            DROP COLUMN IF EXISTS localidad,
            DROP COLUMN IF EXISTS domicilio
    """)
