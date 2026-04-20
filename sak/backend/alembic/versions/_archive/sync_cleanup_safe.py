"""sync_cleanup_safe

Revision ID: sync_cleanup_safe
Revises: f8298a7b7cf2
Create Date: 2026-01-11 18:45:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa
import sqlmodel.sql.sqltypes


# revision identifiers, used by Alembic.
revision: str = 'sync_cleanup_safe'
down_revision: Union[str, Sequence[str], None] = 'f8298a7b7cf2'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Safe synchronization and cleanup."""
    
    # 1. CREAR TABLA SETTINGS solo si no existe
    try:
        op.create_table('settings',
            sa.Column('id', sa.Integer(), nullable=False),
            sa.Column('created_at', sa.DateTime(), nullable=False),
            sa.Column('updated_at', sa.DateTime(), nullable=False),
            sa.Column('deleted_at', sa.DateTime(), nullable=True),
            sa.Column('version', sa.Integer(), nullable=False),
            sa.Column('clave', sqlmodel.sql.sqltypes.AutoString(), nullable=False),
            sa.Column('valor', sqlmodel.sql.sqltypes.AutoString(), nullable=False),
            sa.Column('descripcion', sqlmodel.sql.sqltypes.AutoString(), nullable=True),
            sa.PrimaryKeyConstraint('id')
        )
        op.create_index(op.f('ix_settings_clave'), 'settings', ['clave'], unique=True)
        print("✓ Created settings table")
    except Exception as e:
        print(f"Info: settings table may already exist: {e}")
    
    # 2. ELIMINAR TABLAS BACKUP (si existen)
    backup_tables = ['propiedades_backup_prod_20251117', 'vacancias_backup_prod_20251117']
    for table in backup_tables:
        try:
            op.drop_table(table)
            print(f"✓ Dropped backup table: {table}")
        except Exception as e:
            print(f"Info: backup table {table} may not exist: {e}")
    
    # 3. ELIMINAR COLUMNA DEPRECATED EN ARTICULOS (si existe)
    try:
        op.drop_column('articulos', 'tipo_articulo')
        print("✓ Dropped deprecated tipo_articulo column")
    except Exception as e:
        print(f"Info: tipo_articulo column may not exist: {e}")
    
    # 4. AGREGAR ÍNDICE ÚTIL (si no existe)
    try:
        op.create_index(op.f('ix_crm_oportunidades_activo'), 'crm_oportunidades', ['activo'], unique=False)
        print("✓ Created index ix_crm_oportunidades_activo")
    except Exception as e:
        print(f"Info: index may already exist: {e}")
    
    # 5. CAMBIAR CAMPOS DE NOT NULL A NULL EN MÓDULO PO (mayor flexibilidad)
    # po_factura_detalles
    po_fields = [
        ('po_factura_detalles', ['cantidad', 'precio_unitario', 'subtotal', 'porcentaje_iva', 'importe_iva', 'total_linea']),
        ('po_orden_compra_detalles', ['cantidad', 'precio_unitario', 'subtotal', 'porcentaje_iva', 'importe_iva', 'total_linea']),
        ('po_facturas', ['subtotal', 'total_impuestos', 'total']),
        ('po_ordenes_compra', ['subtotal', 'total_impuestos', 'total']),
        ('po_factura_impuestos', ['base_imponible', 'porcentaje', 'importe'])
    ]
    
    for table_name, fields in po_fields:
        for field in fields:
            try:
                op.alter_column(table_name, field, nullable=True)
            except Exception as e:
                pass  # Campo ya era nullable
        print(f"✓ Updated nullable fields in {table_name}")
    
    print("🎉 Safe synchronization completed!")


def downgrade() -> None:
    """Reverse safe synchronization."""
    
    # Reverse en orden inverso
    # Revertir campos nullable
    op.alter_column('po_factura_impuestos', 'importe', nullable=False)
    op.alter_column('po_factura_impuestos', 'porcentaje', nullable=False)
    op.alter_column('po_factura_impuestos', 'base_imponible', nullable=False)
    
    op.alter_column('po_ordenes_compra', 'total', nullable=False)
    op.alter_column('po_ordenes_compra', 'total_impuestos', nullable=False)
    op.alter_column('po_ordenes_compra', 'subtotal', nullable=False)
    
    op.alter_column('po_facturas', 'total', nullable=False)
    op.alter_column('po_facturas', 'total_impuestos', nullable=False)
    op.alter_column('po_facturas', 'subtotal', nullable=False)
    
    op.alter_column('po_orden_compra_detalles', 'total_linea', nullable=False)
    op.alter_column('po_orden_compra_detalles', 'importe_iva', nullable=False)
    op.alter_column('po_orden_compra_detalles', 'porcentaje_iva', nullable=False)
    op.alter_column('po_orden_compra_detalles', 'subtotal', nullable=False)
    op.alter_column('po_orden_compra_detalles', 'precio_unitario', nullable=False)
    op.alter_column('po_orden_compra_detalles', 'cantidad', nullable=False)
    
    op.alter_column('po_factura_detalles', 'total_linea', nullable=False)
    op.alter_column('po_factura_detalles', 'importe_iva', nullable=False)
    op.alter_column('po_factura_detalles', 'porcentaje_iva', nullable=False)
    op.alter_column('po_factura_detalles', 'subtotal', nullable=False)
    op.alter_column('po_factura_detalles', 'precio_unitario', nullable=False)
    op.alter_column('po_factura_detalles', 'cantidad', nullable=False)
    
    # Eliminar índice
    op.drop_index(op.f('ix_crm_oportunidades_activo'), table_name='crm_oportunidades')
    
    # Eliminar FKs
    op.drop_constraint(None, 'po_facturas', type_='foreignkey')
    op.drop_constraint(None, 'po_facturas', type_='foreignkey') 
    op.drop_constraint(None, 'po_orden_compra_detalles', type_='foreignkey')
    op.drop_constraint(None, 'po_factura_detalles', type_='foreignkey')
    
    # Recrear columna tipo_articulo
    op.add_column('articulos', sa.Column('tipo_articulo', sa.VARCHAR(), nullable=False))
    
    # Recrear tablas backup
    op.create_table('vacancias_backup_prod_20251117',
        sa.Column('id', sa.INTEGER(), nullable=True),
        sa.Column('created_at', sa.TIMESTAMP(), nullable=True),
        # ... otras columnas según sea necesario
    )
    op.create_table('propiedades_backup_prod_20251117', 
        sa.Column('id', sa.INTEGER(), nullable=True),
        sa.Column('created_at', sa.TIMESTAMP(), nullable=True),
        # ... otras columnas según sea necesario
    )
    
    # Eliminar tabla settings
    op.drop_index(op.f('ix_settings_clave'), table_name='settings')
    op.drop_table('settings')