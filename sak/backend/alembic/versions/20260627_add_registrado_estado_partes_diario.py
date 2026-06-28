"""Add estado 'registrado' to partes_diario lifecycle

Revision ID: 20260627_add_registrado_estado_partes_diario
Revises: 20260625_proyecto_encargados_contactos_operativos
Create Date: 2026-06-27
"""
from typing import Union

from alembic import op

revision: str = "20260627_add_registrado_estado_partes_diario"
down_revision: Union[str, None] = "20260625_proyecto_encargados_contactos_operativos"
branch_labels = None
depends_on = None


def upgrade() -> None:
    # La columna estado es string; el nuevo valor queda habilitado por aplicacion.
    pass


def downgrade() -> None:
    op.execute("UPDATE partes_diario SET estado = 'cerrado' WHERE estado = 'registrado'")
