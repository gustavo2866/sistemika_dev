"""add constructora_pedidos

Revision ID: 20260523_add_constructora_pedidos
Revises: 20260520_create_channel_events
Create Date: 2026-05-23

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

revision: str = "20260523_add_constructora_pedidos"
down_revision: Union[str, Sequence[str], None] = "20260520_create_channel_events"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table(
        "constructora_pedidos",
        sa.Column("id", sa.Integer(), nullable=False),
        sa.Column("oportunidad_id", sa.Integer(), nullable=False),
        sa.Column("contacto_id", sa.Integer(), nullable=True),
        sa.Column("mensaje_origen_id", sa.Integer(), nullable=True),
        sa.Column("estado", sa.String(length=20), nullable=False, server_default="pendiente"),
        sa.Column("origen", sa.String(length=20), nullable=False, server_default="manual"),
        sa.Column("titulo", sa.String(length=300), nullable=False),
        sa.Column("observaciones", sa.Text(), nullable=True),
        sa.Column("solicitante_id", sa.Integer(), nullable=True),
        sa.Column("responsable_revision_id", sa.Integer(), nullable=True),
        sa.Column("fecha_confirmacion_agente", sa.DateTime(), nullable=True),
        sa.Column("fecha_revision", sa.DateTime(), nullable=True),
        sa.Column("fecha_generacion_po", sa.DateTime(), nullable=True),
        sa.Column("metadata", postgresql.JSONB(astext_type=sa.Text()), nullable=True),
        sa.Column("created_at", sa.DateTime(), nullable=False),
        sa.Column("updated_at", sa.DateTime(), nullable=False),
        sa.Column("deleted_at", sa.DateTime(), nullable=True),
        sa.Column("version", sa.Integer(), nullable=False),
        sa.ForeignKeyConstraint(["contacto_id"], ["crm_contactos.id"]),
        sa.ForeignKeyConstraint(["mensaje_origen_id"], ["crm_mensajes.id"]),
        sa.ForeignKeyConstraint(["oportunidad_id"], ["crm_oportunidades.id"]),
        sa.ForeignKeyConstraint(["responsable_revision_id"], ["users.id"]),
        sa.ForeignKeyConstraint(["solicitante_id"], ["users.id"]),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("mensaje_origen_id", name="uq_constructora_pedidos_mensaje_origen"),
    )
    op.create_index("ix_constructora_pedidos_oportunidad_id", "constructora_pedidos", ["oportunidad_id"])
    op.create_index("ix_constructora_pedidos_estado", "constructora_pedidos", ["estado"])

    op.create_table(
        "constructora_pedido_detalles",
        sa.Column("id", sa.Integer(), nullable=False),
        sa.Column("pedido_id", sa.Integer(), nullable=False),
        sa.Column("articulo_id", sa.Integer(), nullable=True),
        sa.Column("tipo_solicitud_id", sa.Integer(), nullable=True),
        sa.Column("descripcion_original", sa.String(length=500), nullable=True),
        sa.Column("descripcion", sa.String(length=500), nullable=True),
        sa.Column("unidad_medida", sa.String(length=50), nullable=True),
        sa.Column("cantidad", sa.DECIMAL(12, 3), nullable=False),
        sa.Column("centro_costo_id", sa.Integer(), nullable=True),
        sa.Column("po_order_id", sa.Integer(), nullable=True),
        sa.Column("po_order_detail_id", sa.Integer(), nullable=True),
        sa.Column("orden", sa.Integer(), nullable=False, server_default="0"),
        sa.Column("metadata", postgresql.JSONB(astext_type=sa.Text()), nullable=True),
        sa.Column("created_at", sa.DateTime(), nullable=False),
        sa.Column("updated_at", sa.DateTime(), nullable=False),
        sa.Column("deleted_at", sa.DateTime(), nullable=True),
        sa.Column("version", sa.Integer(), nullable=False),
        sa.ForeignKeyConstraint(["articulo_id"], ["articulos.id"]),
        sa.ForeignKeyConstraint(["centro_costo_id"], ["centros_costo.id"]),
        sa.ForeignKeyConstraint(["pedido_id"], ["constructora_pedidos.id"]),
        sa.ForeignKeyConstraint(["po_order_detail_id"], ["po_order_details.id"]),
        sa.ForeignKeyConstraint(["po_order_id"], ["po_orders.id"]),
        sa.ForeignKeyConstraint(["tipo_solicitud_id"], ["tipos_solicitud.id"]),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index("ix_constructora_pedido_detalles_pedido_id", "constructora_pedido_detalles", ["pedido_id"])
    op.create_index("ix_constructora_pedido_detalles_articulo_id", "constructora_pedido_detalles", ["articulo_id"])
    op.create_index("ix_constructora_pedido_detalles_tipo_solicitud_id", "constructora_pedido_detalles", ["tipo_solicitud_id"])
    op.create_index("ix_constructora_pedido_detalles_po_order_id", "constructora_pedido_detalles", ["po_order_id"])


def downgrade() -> None:
    op.drop_index("ix_constructora_pedido_detalles_po_order_id", table_name="constructora_pedido_detalles")
    op.drop_index("ix_constructora_pedido_detalles_tipo_solicitud_id", table_name="constructora_pedido_detalles")
    op.drop_index("ix_constructora_pedido_detalles_articulo_id", table_name="constructora_pedido_detalles")
    op.drop_index("ix_constructora_pedido_detalles_pedido_id", table_name="constructora_pedido_detalles")
    op.drop_table("constructora_pedido_detalles")

    op.drop_index("ix_constructora_pedidos_estado", table_name="constructora_pedidos")
    op.drop_index("ix_constructora_pedidos_oportunidad_id", table_name="constructora_pedidos")
    op.drop_table("constructora_pedidos")
