"""Add purchase order models - PO module

Revision ID: 58ebe380bb01
Revises: 029_crm_catresp
Create Date: 2026-01-07 15:33:58.188496

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = '58ebe380bb01'
down_revision: Union[str, Sequence[str], None] = '029_crm_catresp'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Upgrade schema."""
    # Create po_solicitudes table
    op.create_table(
        'po_solicitudes',
        sa.Column('id', sa.Integer(), nullable=False),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
        sa.Column('updated_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
        sa.Column('tipo_solicitud_id', sa.Integer(), nullable=False),
        sa.Column('departamento_id', sa.Integer(), nullable=False),
        sa.Column('estado', sa.String(length=20), nullable=False),
        sa.Column('total', sa.DECIMAL(precision=15, scale=2), server_default='0', nullable=False),
        sa.Column('fecha_necesidad', sa.Date(), nullable=False),
        sa.Column('comentario', sa.String(length=1000), nullable=True),
        sa.Column('solicitante_id', sa.Integer(), nullable=False),
        sa.Column('centro_costo_id', sa.Integer(), nullable=False),
        sa.Column('oportunidad_id', sa.Integer(), nullable=True),
        sa.Column('proveedor_id', sa.Integer(), nullable=True),
        sa.ForeignKeyConstraint(['centro_costo_id'], ['centros_costo.id'], ),
        sa.ForeignKeyConstraint(['departamento_id'], ['departamentos.id'], ),
        sa.ForeignKeyConstraint(['oportunidad_id'], ['crm_oportunidades.id'], ),
        sa.ForeignKeyConstraint(['proveedor_id'], ['proveedores.id'], ),
        sa.ForeignKeyConstraint(['solicitante_id'], ['users.id'], ),
        sa.ForeignKeyConstraint(['tipo_solicitud_id'], ['tipos_solicitud.id'], ),
        sa.PrimaryKeyConstraint('id')
    )
    op.create_index('ix_po_solicitudes_oportunidad_id', 'po_solicitudes', ['oportunidad_id'])
    op.create_index('ix_po_solicitudes_proveedor_id', 'po_solicitudes', ['proveedor_id'])

    # Create po_solicitud_detalles table
    op.create_table(
        'po_solicitud_detalles',
        sa.Column('id', sa.Integer(), nullable=False),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
        sa.Column('updated_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
        sa.Column('solicitud_id', sa.Integer(), nullable=False),
        sa.Column('articulo_id', sa.Integer(), nullable=True),
        sa.Column('descripcion', sa.String(length=500), nullable=False),
        sa.Column('unidad_medida', sa.String(length=50), nullable=True),
        sa.Column('cantidad', sa.DECIMAL(precision=12, scale=3), nullable=False),
        sa.Column('precio', sa.DECIMAL(precision=15, scale=2), server_default='0', nullable=False),
        sa.Column('importe', sa.DECIMAL(precision=15, scale=2), server_default='0', nullable=False),
        sa.ForeignKeyConstraint(['articulo_id'], ['articulos.id'], ),
        sa.ForeignKeyConstraint(['solicitud_id'], ['po_solicitudes.id'], ),
        sa.PrimaryKeyConstraint('id')
    )

    # Create po_ordenes_compra table
    op.create_table(
        'po_ordenes_compra',
        sa.Column('id', sa.Integer(), nullable=False),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
        sa.Column('updated_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
        sa.Column('numero', sa.String(length=50), nullable=False),
        sa.Column('fecha_emision', sa.Date(), nullable=False),
        sa.Column('fecha_recepcion', sa.DateTime(), nullable=False),
        sa.Column('estado', sa.String(length=20), nullable=False),
        sa.Column('observaciones', sa.Text(), nullable=True),
        sa.Column('subtotal', sa.DECIMAL(precision=15, scale=2), nullable=False),
        sa.Column('total_impuestos', sa.DECIMAL(precision=15, scale=2), nullable=False),
        sa.Column('total', sa.DECIMAL(precision=15, scale=2), nullable=False),
        sa.Column('proveedor_id', sa.Integer(), nullable=False),
        sa.Column('usuario_responsable_id', sa.Integer(), nullable=False),
        sa.Column('metodo_pago_id', sa.Integer(), nullable=False),
        sa.Column('registrado_por_id', sa.Integer(), nullable=False),
        sa.ForeignKeyConstraint(['metodo_pago_id'], ['metodos_pago.id'], ),
        sa.ForeignKeyConstraint(['proveedor_id'], ['proveedores.id'], ),
        sa.ForeignKeyConstraint(['registrado_por_id'], ['users.id'], ),
        sa.ForeignKeyConstraint(['usuario_responsable_id'], ['users.id'], ),
        sa.PrimaryKeyConstraint('id')
    )

    # Create po_orden_compra_detalles table
    op.create_table(
        'po_orden_compra_detalles',
        sa.Column('id', sa.Integer(), nullable=False),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
        sa.Column('updated_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
        sa.Column('codigo_producto', sa.String(length=50), nullable=True),
        sa.Column('descripcion', sa.String(length=500), nullable=False),
        sa.Column('cantidad', sa.DECIMAL(precision=10, scale=3), nullable=False),
        sa.Column('unidad_medida', sa.String(length=10), nullable=True),
        sa.Column('precio_unitario', sa.DECIMAL(precision=15, scale=4), nullable=False),
        sa.Column('subtotal', sa.DECIMAL(precision=15, scale=2), nullable=False),
        sa.Column('porcentaje_descuento', sa.DECIMAL(precision=5, scale=2), nullable=True),
        sa.Column('importe_descuento', sa.DECIMAL(precision=15, scale=2), nullable=True),
        sa.Column('porcentaje_iva', sa.DECIMAL(precision=5, scale=2), nullable=False),
        sa.Column('importe_iva', sa.DECIMAL(precision=15, scale=2), nullable=False),
        sa.Column('total_linea', sa.DECIMAL(precision=15, scale=2), nullable=False),
        sa.Column('orden', sa.Integer(), nullable=False),
        sa.Column('orden_compra_id', sa.Integer(), nullable=False),
        sa.Column('solicitud_detalle_id', sa.Integer(), nullable=False),
        sa.ForeignKeyConstraint(['orden_compra_id'], ['po_ordenes_compra.id'], ),
        sa.ForeignKeyConstraint(['solicitud_detalle_id'], ['po_solicitud_detalles.id'], ),
        sa.PrimaryKeyConstraint('id')
    )

    # Create po_facturas table
    op.create_table(
        'po_facturas',
        sa.Column('id', sa.Integer(), nullable=False),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
        sa.Column('updated_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
        sa.Column('numero', sa.String(length=50), nullable=False),
        sa.Column('punto_venta', sa.String(length=10), nullable=False),
        sa.Column('id_tipocomprobante', sa.Integer(), nullable=False),
        sa.Column('fecha_emision', sa.String(), nullable=False),
        sa.Column('fecha_vencimiento', sa.String(), nullable=True),
        sa.Column('fecha_recepcion', sa.DateTime(), nullable=False),
        sa.Column('subtotal', sa.DECIMAL(precision=15, scale=2), nullable=False),
        sa.Column('total_impuestos', sa.DECIMAL(precision=15, scale=2), nullable=False),
        sa.Column('total', sa.DECIMAL(precision=15, scale=2), nullable=False),
        sa.Column('estado', sa.String(), nullable=False),
        sa.Column('observaciones', sa.Text(), nullable=True),
        sa.Column('nombre_archivo_pdf', sa.String(length=500), nullable=True),
        sa.Column('ruta_archivo_pdf', sa.String(length=1000), nullable=True),
        sa.Column('comprobante_id', sa.Integer(), nullable=True),
        sa.Column('proveedor_id', sa.Integer(), nullable=False),
        sa.Column('tipo_operacion_id', sa.Integer(), nullable=False),
        sa.Column('usuario_responsable_id', sa.Integer(), nullable=False),
        sa.Column('metodo_pago_id', sa.Integer(), nullable=False),
        sa.Column('registrado_por_id', sa.Integer(), nullable=False),
        sa.Column('propiedad_id', sa.Integer(), nullable=True),
        sa.ForeignKeyConstraint(['comprobante_id'], ['comprobantes.id'], ),
        sa.ForeignKeyConstraint(['id_tipocomprobante'], ['tipos_comprobante.id'], ),
        sa.ForeignKeyConstraint(['metodo_pago_id'], ['metodos_pago.id'], ),
        sa.ForeignKeyConstraint(['propiedad_id'], ['propiedades.id'], ),
        sa.ForeignKeyConstraint(['proveedor_id'], ['proveedores.id'], ),
        sa.ForeignKeyConstraint(['registrado_por_id'], ['users.id'], ),
        sa.ForeignKeyConstraint(['tipo_operacion_id'], ['tipos_operacion.id'], ),
        sa.ForeignKeyConstraint(['usuario_responsable_id'], ['users.id'], ),
        sa.PrimaryKeyConstraint('id')
    )

    # Create po_factura_detalles table
    op.create_table(
        'po_factura_detalles',
        sa.Column('id', sa.Integer(), nullable=False),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
        sa.Column('updated_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
        sa.Column('codigo_producto', sa.String(length=50), nullable=True),
        sa.Column('descripcion', sa.String(length=500), nullable=False),
        sa.Column('cantidad', sa.DECIMAL(precision=10, scale=3), nullable=False),
        sa.Column('unidad_medida', sa.String(length=10), nullable=True),
        sa.Column('precio_unitario', sa.DECIMAL(precision=15, scale=4), nullable=False),
        sa.Column('subtotal', sa.DECIMAL(precision=15, scale=2), nullable=False),
        sa.Column('porcentaje_descuento', sa.DECIMAL(precision=5, scale=2), nullable=True),
        sa.Column('importe_descuento', sa.DECIMAL(precision=15, scale=2), nullable=True),
        sa.Column('porcentaje_iva', sa.DECIMAL(precision=5, scale=2), nullable=False),
        sa.Column('importe_iva', sa.DECIMAL(precision=15, scale=2), nullable=False),
        sa.Column('total_linea', sa.DECIMAL(precision=15, scale=2), nullable=False),
        sa.Column('orden', sa.Integer(), nullable=False),
        sa.Column('factura_id', sa.Integer(), nullable=False),
        sa.Column('orden_compra_detalle_id', sa.Integer(), nullable=False),
        sa.ForeignKeyConstraint(['factura_id'], ['po_facturas.id'], ),
        sa.ForeignKeyConstraint(['orden_compra_detalle_id'], ['po_orden_compra_detalles.id'], ),
        sa.PrimaryKeyConstraint('id')
    )

    # Create po_factura_impuestos table
    op.create_table(
        'po_factura_impuestos',
        sa.Column('id', sa.Integer(), nullable=False),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
        sa.Column('updated_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
        sa.Column('tipo_impuesto', sa.String(length=50), nullable=False),
        sa.Column('descripcion', sa.String(length=255), nullable=False),
        sa.Column('base_imponible', sa.DECIMAL(precision=15, scale=2), nullable=False),
        sa.Column('porcentaje', sa.DECIMAL(precision=5, scale=4), nullable=False),
        sa.Column('importe', sa.DECIMAL(precision=15, scale=2), nullable=False),
        sa.Column('es_retencion', sa.Boolean(), nullable=False),
        sa.Column('es_percepcion', sa.Boolean(), nullable=False),
        sa.Column('codigo_afip', sa.String(length=20), nullable=True),
        sa.Column('numero_certificado', sa.String(length=50), nullable=True),
        sa.Column('factura_id', sa.Integer(), nullable=False),
        sa.ForeignKeyConstraint(['factura_id'], ['po_facturas.id'], ),
        sa.PrimaryKeyConstraint('id')
    )


def downgrade() -> None:
    """Downgrade schema."""
    op.drop_table('po_factura_impuestos')
    op.drop_table('po_factura_detalles')
    op.drop_table('po_facturas')
    op.drop_table('po_orden_compra_detalles')
    op.drop_table('po_ordenes_compra')
    op.drop_table('po_solicitud_detalles')
    op.drop_index('ix_po_solicitudes_proveedor_id', 'po_solicitudes')
    op.drop_index('ix_po_solicitudes_oportunidad_id', 'po_solicitudes')
    op.drop_table('po_solicitudes')
