"""Add mensaje_origen_id to partes_diario and origen to partes_diario_detalles

Revision ID: 20260530_add_mensaje_origen_origen_detalle_partes_diario
Revises: 20260530_add_ingreso_egreso_partes_diario_detalles
Create Date: 2026-05-30

Cambios:
- partes_diario: agrega columna mensaje_origen_id (FK a crm_mensajes.id, nullable)
- partes_diario_detalles: agrega columna origen VARCHAR(10) NOT NULL DEFAULT 'agente'
  Valores: 'agente' = informado explícitamente por el encargado
           'default' = presente implícito generado al confirmar
"""
from typing import Union

import sqlalchemy as sa
from alembic import op

revision: str = "20260530_add_mensaje_origen_origen_detalle_partes_diario"
down_revision: Union[str, None] = "20260530_add_ingreso_egreso_partes_diario_detalles"
branch_labels = None
depends_on = None


def upgrade() -> None:
    # partes_diario: FK al mensaje de WhatsApp que originó el parte
    op.add_column(
        "partes_diario",
        sa.Column(
            "mensaje_origen_id",
            sa.Integer(),
            sa.ForeignKey("crm_mensajes.id", name="fk_partes_diario_mensaje_origen"),
            nullable=True,
            comment="Mensaje de WhatsApp que confirmó este parte (trazabilidad con el agente)",
        ),
    )
    op.create_index(
        "ix_partes_diario_mensaje_origen_id",
        "partes_diario",
        ["mensaje_origen_id"],
        unique=False,
    )

    # partes_diario_detalles: origen de la línea
    op.add_column(
        "partes_diario_detalles",
        sa.Column(
            "origen",
            sa.String(10),
            nullable=False,
            server_default="agente",
            comment="'agente' = informado por encargado, 'default' = presente implícito",
        ),
    )


def downgrade() -> None:
    op.drop_column("partes_diario_detalles", "origen")
    op.drop_index("ix_partes_diario_mensaje_origen_id", table_name="partes_diario")
    op.drop_column("partes_diario", "mensaje_origen_id")
