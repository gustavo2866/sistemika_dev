"""Rename estado 'pendiente' to 'borrador' in partes_diario

Revision ID: 20260530_rename_pendiente_to_borrador_partes_diario
Revises: 20260530_add_mensaje_origen_origen_detalle_partes_diario
Create Date: 2026-05-30

Ciclo de vida del parte diario:
  borrador → generado por el agente, editable desde WhatsApp
  cerrado  → cerrado por el administrador, solo lectura para el agente
"""
from typing import Union

from alembic import op

revision: str = "20260530_rename_pendiente_to_borrador_partes_diario"
down_revision: Union[str, None] = "20260530_add_mensaje_origen_origen_detalle_partes_diario"
branch_labels = None
depends_on = None


def upgrade() -> None:
    # Renombrar valor existente
    op.execute("UPDATE partes_diario SET estado = 'borrador' WHERE estado = 'pendiente'")
    # Actualizar el server_default de la columna
    op.alter_column(
        "partes_diario",
        "estado",
        server_default="borrador",
    )


def downgrade() -> None:
    op.execute("UPDATE partes_diario SET estado = 'pendiente' WHERE estado = 'borrador'")
    op.alter_column(
        "partes_diario",
        "estado",
        server_default="pendiente",
    )
