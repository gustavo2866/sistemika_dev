"""add tipos_propiedad and fk to crm_oportunidades

Revision ID: add_tipos_propiedad
Revises: rename_estado_confirmado
Create Date: 2025-11-27 11:00:00.000000

"""
from alembic import op
import sqlalchemy as sa
import sqlmodel


# revision identifiers, used by Alembic.
revision = 'add_tipos_propiedad'
down_revision = 'rename_estado_confirmado'
branch_labels = None
depends_on = None


def upgrade() -> None:
    # Paso 1: Crear tabla tipos_propiedad
    op.create_table(
        'tipos_propiedad',
        sa.Column('id', sa.Integer(), nullable=False),
        sa.Column('created_at', sa.DateTime(), nullable=False),
        sa.Column('updated_at', sa.DateTime(), nullable=False),
        sa.Column('deleted_at', sa.DateTime(), nullable=True),
        sa.Column('version', sa.Integer(), nullable=False),
        sa.Column('codigo', sqlmodel.sql.sqltypes.AutoString(length=50), nullable=False),
        sa.Column('nombre', sqlmodel.sql.sqltypes.AutoString(length=100), nullable=False),
        sa.Column('descripcion', sqlmodel.sql.sqltypes.AutoString(length=500), nullable=True),
        sa.Column('activo', sa.Boolean(), nullable=False),
        sa.PrimaryKeyConstraint('id'),
    )
    op.create_index(op.f('ix_tipos_propiedad_codigo'), 'tipos_propiedad', ['codigo'], unique=True)
    
    # Paso 2: Poblar con tipos existentes basados en propiedades actuales
    op.execute("""
        INSERT INTO tipos_propiedad (created_at, updated_at, version, codigo, nombre, activo)
        VALUES
            (NOW(), NOW(), 1, 'CASA', 'Casa', true),
            (NOW(), NOW(), 1, 'DEPTO', 'Departamento', true),
            (NOW(), NOW(), 1, 'LOCAL', 'Local Comercial', true),
            (NOW(), NOW(), 1, 'OFICINA', 'Oficina', true),
            (NOW(), NOW(), 1, 'TERRENO', 'Terreno', true),
            (NOW(), NOW(), 1, 'GALPON', 'Galpón', true),
            (NOW(), NOW(), 1, 'DEPOSITO', 'Depósito', true),
            (NOW(), NOW(), 1, 'COCHERA', 'Cochera', true)
    """)
    
    # Paso 3: Agregar columna tipo_propiedad_id a crm_oportunidades (nullable)
    op.add_column(
        'crm_oportunidades',
        sa.Column('tipo_propiedad_id', sa.Integer(), nullable=True)
    )
    
    # Paso 4: Crear índice y FK constraint
    op.create_index(
        op.f('ix_crm_oportunidades_tipo_propiedad_id'),
        'crm_oportunidades',
        ['tipo_propiedad_id'],
        unique=False
    )
    
    op.create_foreign_key(
        'fk_crm_oportunidades_tipo_propiedad',
        'crm_oportunidades',
        'tipos_propiedad',
        ['tipo_propiedad_id'],
        ['id']
    )


def downgrade() -> None:
    # Paso 1: Eliminar FK y columna de crm_oportunidades
    op.drop_constraint('fk_crm_oportunidades_tipo_propiedad', 'crm_oportunidades', type_='foreignkey')
    op.drop_index(op.f('ix_crm_oportunidades_tipo_propiedad_id'), table_name='crm_oportunidades')
    op.drop_column('crm_oportunidades', 'tipo_propiedad_id')
    
    # Paso 2: Eliminar tabla tipos_propiedad
    op.drop_index(op.f('ix_tipos_propiedad_codigo'), table_name='tipos_propiedad')
    op.drop_table('tipos_propiedad')
