"""parte_diario: replace cerrado/registrado states

Revision ID: 20260628_parte_diario_confirmado_cerrado
Revises: 20260627_unique_tarja_quincena
Create Date: 2026-06-28
"""

from typing import Sequence, Union

from alembic import op


revision: str = "20260628_parte_diario_confirmado_cerrado"
down_revision: Union[str, None] = "20260627_unique_tarja_quincena"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.execute(
        """
        UPDATE partes_diario
        SET estado = '__registrado_legacy__'
        WHERE estado = 'registrado'
        """
    )
    op.execute(
        """
        UPDATE partes_diario
        SET estado = 'confirmado'
        WHERE estado = 'cerrado'
        """
    )
    op.execute(
        """
        UPDATE partes_diario
        SET estado = 'cerrado'
        WHERE estado = '__registrado_legacy__'
        """
    )


def downgrade() -> None:
    op.execute(
        """
        UPDATE partes_diario
        SET estado = '__cerrado_legacy__'
        WHERE estado = 'cerrado'
        """
    )
    op.execute(
        """
        UPDATE partes_diario
        SET estado = 'cerrado'
        WHERE estado = 'confirmado'
        """
    )
    op.execute(
        """
        UPDATE partes_diario
        SET estado = 'registrado'
        WHERE estado = '__cerrado_legacy__'
        """
    )
