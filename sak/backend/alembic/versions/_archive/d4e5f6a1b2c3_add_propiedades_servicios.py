"""add propiedades_servicios table

Revision ID: d4e5f6a1b2c3
Revises: c3d4e5f6a1b2
Create Date: 2025-01-01 00:00:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = "d4e5f6a1b2c3"
down_revision: Union[str, None] = "c3d4e5f6a1b2"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.execute("""
        CREATE TABLE IF NOT EXISTS propiedades_servicios (
            id SERIAL PRIMARY KEY,
            propiedad_id INTEGER NOT NULL REFERENCES propiedades(id),
            servicio_tipo_id INTEGER REFERENCES servicios_tipo(id),
            ref_cliente VARCHAR(200),
            comentario VARCHAR(1000),
            fecha DATE,
            activo BOOLEAN NOT NULL DEFAULT TRUE,
            created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
            updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
            deleted_at TIMESTAMP WITH TIME ZONE,
            version INTEGER NOT NULL DEFAULT 1
        )
    """)
    op.execute("CREATE INDEX IF NOT EXISTS ix_propiedades_servicios_propiedad_id ON propiedades_servicios (propiedad_id)")
    op.execute("CREATE INDEX IF NOT EXISTS ix_propiedades_servicios_servicio_tipo_id ON propiedades_servicios (servicio_tipo_id)")


def downgrade() -> None:
    op.execute("DROP TABLE IF EXISTS propiedades_servicios")
