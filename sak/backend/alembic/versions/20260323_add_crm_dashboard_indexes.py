"""add crm dashboard indexes

Revision ID: 20260323_add_crm_dashboard_indexes
Revises: 20260321_add_po_order_status_log
Create Date: 2026-03-23

"""
from typing import Sequence, Union

from alembic import op

# revision identifiers, used by Alembic.
revision: str = "20260323_add_crm_dashboard_indexes"
down_revision: Union[str, Sequence[str], None] = "20260321_add_po_order_status_log"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_index(
        "ix_crm_oportunidades_estado",
        "crm_oportunidades",
        ["estado"],
        unique=False,
    )
    op.create_index(
        "ix_crm_oportunidades_tipo_operacion_id",
        "crm_oportunidades",
        ["tipo_operacion_id"],
        unique=False,
    )
    op.create_index(
        "ix_crm_oportunidades_fecha_estado",
        "crm_oportunidades",
        ["fecha_estado"],
        unique=False,
    )
    op.create_index(
        "ix_crm_mensajes_oportunidad_tipo_estado",
        "crm_mensajes",
        ["oportunidad_id", "tipo", "estado"],
        unique=False,
        postgresql_where="deleted_at IS NULL",
    )
    op.create_index(
        "ix_crm_eventos_oportunidad_estado_fecha",
        "crm_eventos",
        ["oportunidad_id", "estado_evento", "fecha_evento"],
        unique=False,
        postgresql_where="deleted_at IS NULL",
    )


def downgrade() -> None:
    op.drop_index("ix_crm_eventos_oportunidad_estado_fecha", table_name="crm_eventos")
    op.drop_index("ix_crm_mensajes_oportunidad_tipo_estado", table_name="crm_mensajes")
    op.drop_index("ix_crm_oportunidades_fecha_estado", table_name="crm_oportunidades")
    op.drop_index("ix_crm_oportunidades_tipo_operacion_id", table_name="crm_oportunidades")
    op.drop_index("ix_crm_oportunidades_estado", table_name="crm_oportunidades")
