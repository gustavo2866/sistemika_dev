"""add_tipo_compra_and_default_fields_to_tables

Revision ID: 20260124_add_tipo_compra_and_default_fields
Revises: 20260124_add_ultimo_mensaje_fields_to_crm_oportunidades
Create Date: 2026-01-24 10:00:00.000000

"""
from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

# revision identifiers, used by Alembic.
revision = '20260124_add_tipo_compra_and_default_fields'
down_revision = '20260124_add_ultimo_mensaje_fields_to_crm_oportunidades'
branch_labels = None
depends_on = None


def upgrade():
    # 1. Agregar tipo_compra a solicitudes
    op.add_column('solicitudes', sa.Column('tipo_compra', sa.String(20), nullable=False, server_default='normal'))
    
    # 2. Agregar departamento_id y tipo_compra a po_ordenes_compra
    op.add_column('po_ordenes_compra', sa.Column('departamento_id', sa.Integer(), nullable=True))
    op.add_column('po_ordenes_compra', sa.Column('tipo_compra', sa.String(20), nullable=False, server_default='normal'))
    
    # Agregar foreign key para departamento_id en po_ordenes_compra
    op.create_foreign_key('fk_po_ordenes_compra_departamento_id', 'po_ordenes_compra', 'departamentos', ['departamento_id'], ['id'])
    
    # 3. Agregar campos default a proveedores
    op.add_column('proveedores', sa.Column('default_tipo_solicitud_id', sa.Integer(), nullable=True))
    op.add_column('proveedores', sa.Column('default_departamento_id', sa.Integer(), nullable=True))
    op.add_column('proveedores', sa.Column('default_metodo_pago_id', sa.Integer(), nullable=True))
    op.add_column('proveedores', sa.Column('default_usuario_responsable_id', sa.Integer(), nullable=True))
    
    # Agregar foreign keys para proveedores
    op.create_foreign_key('fk_proveedores_default_tipo_solicitud_id', 'proveedores', 'tipos_solicitud', ['default_tipo_solicitud_id'], ['id'])
    op.create_foreign_key('fk_proveedores_default_departamento_id', 'proveedores', 'departamentos', ['default_departamento_id'], ['id'])
    op.create_foreign_key('fk_proveedores_default_metodo_pago_id', 'proveedores', 'metodos_pago', ['default_metodo_pago_id'], ['id'])
    op.create_foreign_key('fk_proveedores_default_usuario_responsable_id', 'proveedores', 'users', ['default_usuario_responsable_id'], ['id'])
    
    # 4. Agregar campos opcionales a po_facturas
    op.add_column('po_facturas', sa.Column('departamento_id', sa.Integer(), nullable=True))
    op.add_column('po_facturas', sa.Column('tipo_compra', sa.String(20), nullable=True))
    
    # Agregar foreign key para departamento_id en po_facturas
    op.create_foreign_key('fk_po_facturas_departamento_id', 'po_facturas', 'departamentos', ['departamento_id'], ['id'])
    
    # Crear índices para mejorar performance
    op.create_index('idx_solicitudes_tipo_compra', 'solicitudes', ['tipo_compra'])
    op.create_index('idx_po_ordenes_compra_tipo_compra', 'po_ordenes_compra', ['tipo_compra'])
    op.create_index('idx_po_ordenes_compra_departamento_id', 'po_ordenes_compra', ['departamento_id'])
    op.create_index('idx_proveedores_default_tipo_solicitud_id', 'proveedores', ['default_tipo_solicitud_id'])
    op.create_index('idx_proveedores_default_departamento_id', 'proveedores', ['default_departamento_id'])
    op.create_index('idx_po_facturas_departamento_id', 'po_facturas', ['departamento_id'])


def downgrade():
    # Eliminar índices
    op.drop_index('idx_po_facturas_departamento_id', 'po_facturas')
    op.drop_index('idx_proveedores_default_departamento_id', 'proveedores')
    op.drop_index('idx_proveedores_default_tipo_solicitud_id', 'proveedores')
    op.drop_index('idx_po_ordenes_compra_departamento_id', 'po_ordenes_compra')
    op.drop_index('idx_po_ordenes_compra_tipo_compra', 'po_ordenes_compra')
    op.drop_index('idx_solicitudes_tipo_compra', 'solicitudes')
    
    # Eliminar foreign keys
    op.drop_constraint('fk_po_facturas_departamento_id', 'po_facturas', type_='foreignkey')
    op.drop_constraint('fk_proveedores_default_usuario_responsable_id', 'proveedores', type_='foreignkey')
    op.drop_constraint('fk_proveedores_default_metodo_pago_id', 'proveedores', type_='foreignkey')
    op.drop_constraint('fk_proveedores_default_departamento_id', 'proveedores', type_='foreignkey')
    op.drop_constraint('fk_proveedores_default_tipo_solicitud_id', 'proveedores', type_='foreignkey')
    op.drop_constraint('fk_po_ordenes_compra_departamento_id', 'po_ordenes_compra', type_='foreignkey')
    
    # Eliminar columnas de po_facturas
    op.drop_column('po_facturas', 'tipo_compra')
    op.drop_column('po_facturas', 'departamento_id')
    
    # Eliminar columnas de proveedores
    op.drop_column('proveedores', 'default_usuario_responsable_id')
    op.drop_column('proveedores', 'default_metodo_pago_id')
    op.drop_column('proveedores', 'default_departamento_id')
    op.drop_column('proveedores', 'default_tipo_solicitud_id')
    
    # Eliminar columnas de po_ordenes_compra
    op.drop_column('po_ordenes_compra', 'tipo_compra')
    op.drop_column('po_ordenes_compra', 'departamento_id')
    
    # Eliminar columna de solicitudes
    op.drop_column('solicitudes', 'tipo_compra')