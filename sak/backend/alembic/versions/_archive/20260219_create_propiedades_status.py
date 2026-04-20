"""Create propiedades_status and propiedades_log_status tables

Revision ID: 20260219_create_propiedades_status
Revises: 20260218_add_fecha_pago_to_po_invoices
Create Date: 2026-02-19 12:00:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = '20260219_create_propiedades_status'
down_revision: Union[str, Sequence[str], None] = '20260218_add_fecha_pago_to_po_invoices'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Create propiedades_status and propiedades_log_status tables."""
    
    # Create propiedades_status table
    op.create_table(
        'propiedades_status',
        sa.Column('id', sa.Integer(), nullable=False),
        sa.Column('created_at', sa.DateTime(), nullable=False),
        sa.Column('updated_at', sa.DateTime(), nullable=False),
        sa.Column('deleted_at', sa.DateTime(), nullable=True),
        sa.Column('version', sa.Integer(), nullable=False),
        sa.Column('nombre', sa.String(length=50), nullable=False),
        sa.Column('descripcion', sa.String(length=200), nullable=True),
        sa.Column('orden', sa.Integer(), nullable=False),
        sa.Column('activo', sa.Boolean(), nullable=False),
        sa.Column('es_inicial', sa.Boolean(), nullable=False),
        sa.Column('es_final', sa.Boolean(), nullable=False),
        sa.PrimaryKeyConstraint('id')
    )
    
    # Create unique constraint on nombre
    op.create_unique_constraint('uq_propiedades_status_nombre', 'propiedades_status', ['nombre'])
    
    # Insert default status values
    op.execute("""
        INSERT INTO propiedades_status (created_at, updated_at, version, nombre, descripcion, orden, activo, es_inicial, es_final)
        VALUES 
            (NOW(), NOW(), 1, 'Recibida', 'Propiedad recibida en el sistema', 1, true, true, false),
            (NOW(), NOW(), 1, 'En Reparación', 'Propiedad en proceso de reparación', 2, true, false, false),
            (NOW(), NOW(), 1, 'Disponible', 'Propiedad disponible para alquiler/venta', 3, true, false, false),
            (NOW(), NOW(), 1, 'Realizada', 'Operación realizada (alquilada/vendida)', 4, true, false, true),
            (NOW(), NOW(), 1, 'Retirada', 'Propiedad retirada del sistema', 5, true, false, true)
    """)
    
    # Create propiedades_log_status table
    op.create_table(
        'propiedades_log_status',
        sa.Column('id', sa.Integer(), nullable=False),
        sa.Column('created_at', sa.DateTime(), nullable=False),
        sa.Column('updated_at', sa.DateTime(), nullable=False),
        sa.Column('deleted_at', sa.DateTime(), nullable=True),
        sa.Column('version', sa.Integer(), nullable=False),
        sa.Column('propiedad_id', sa.Integer(), nullable=False),
        sa.Column('estado_anterior_id', sa.Integer(), nullable=True),
        sa.Column('estado_nuevo_id', sa.Integer(), nullable=False),
        sa.Column('estado_anterior', sa.String(length=50), nullable=True),
        sa.Column('estado_nuevo', sa.String(length=50), nullable=False),
        sa.Column('fecha_cambio', sa.DateTime(), nullable=False),
        sa.Column('usuario_id', sa.Integer(), nullable=False),
        sa.Column('motivo', sa.String(length=200), nullable=True),
        sa.Column('observaciones', sa.String(length=1000), nullable=True),
        sa.PrimaryKeyConstraint('id')
    )
    
    # Create foreign key constraints for propiedades_log_status
    op.create_foreign_key('fk_propiedades_log_status_propiedad', 'propiedades_log_status', 'propiedades', ['propiedad_id'], ['id'])
    op.create_foreign_key('fk_propiedades_log_status_estado_anterior', 'propiedades_log_status', 'propiedades_status', ['estado_anterior_id'], ['id'])
    op.create_foreign_key('fk_propiedades_log_status_estado_nuevo', 'propiedades_log_status', 'propiedades_status', ['estado_nuevo_id'], ['id'])
    op.create_foreign_key('fk_propiedades_log_status_usuario', 'propiedades_log_status', 'users', ['usuario_id'], ['id'])
    
    # Create indexes for propiedades_log_status
    op.create_index('ix_propiedades_log_status_propiedad_id', 'propiedades_log_status', ['propiedad_id'], unique=False)
    
    # Add propiedad_status_id column to propiedades table
    op.add_column('propiedades', sa.Column('propiedad_status_id', sa.Integer(), nullable=True))
    
    # Create foreign key constraint
    op.create_foreign_key(
        'fk_propiedades_propiedad_status',
        'propiedades',
        'propiedades_status',
        ['propiedad_status_id'],
        ['id']
    )
    
    # Create index
    op.create_index('ix_propiedades_propiedad_status_id', 'propiedades', ['propiedad_status_id'], unique=False)


def downgrade() -> None:
    """Drop propiedades_status and propiedades_log_status tables and related changes."""
    
    # Drop foreign key and index from propiedades
    op.drop_index('ix_propiedades_propiedad_status_id', table_name='propiedades')
    op.drop_constraint('fk_propiedades_propiedad_status', 'propiedades', type_='foreignkey')
    
    # Drop column from propiedades
    op.drop_column('propiedades', 'propiedad_status_id')
    
    # Drop propiedades_log_status table (with its constraints and indexes)
    op.drop_index('ix_propiedades_log_status_propiedad_id', table_name='propiedades_log_status')
    op.drop_constraint('fk_propiedades_log_status_usuario', 'propiedades_log_status', type_='foreignkey')
    op.drop_constraint('fk_propiedades_log_status_estado_nuevo', 'propiedades_log_status', type_='foreignkey')
    op.drop_constraint('fk_propiedades_log_status_estado_anterior', 'propiedades_log_status', type_='foreignkey')
    op.drop_constraint('fk_propiedades_log_status_propiedad', 'propiedades_log_status', type_='foreignkey')
    op.drop_table('propiedades_log_status')
    
    # Drop propiedades_status table
    op.drop_table('propiedades_status')