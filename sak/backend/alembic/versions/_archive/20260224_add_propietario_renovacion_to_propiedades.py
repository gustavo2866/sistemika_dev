"""add_propietario_and_renovacion_fields_to_propiedades

Revision ID: 20260224_add_propietario_renovacion_to_propiedades
Revises: 20260224_add_tipos_actualizacion_table
Create Date: 2026-02-24 20:15:00.000000

"""
from alembic import op
import sqlalchemy as sa

# revision identifiers, used by Alembic.
revision = "20260224_add_propietario_renovacion_to_propiedades"
down_revision = "20260224_add_tipos_actualizacion_table"
branch_labels = None
depends_on = None


def upgrade():
    """Add propietario_id, tipo_actualizacion_id, and fecha_renovacion to propiedades table"""
    
    # Agregar FK a propietario
    op.add_column("propiedades", sa.Column("propietario_id", sa.Integer(), nullable=True))
    op.create_foreign_key(
        "fk_propiedades_propietario_id", 
        "propiedades", 
        "propietarios", 
        ["propietario_id"], 
        ["id"]
    )
    op.create_index("ix_propiedades_propietario_id", "propiedades", ["propietario_id"])
    
    # Agregar FK a tipo_actualizacion
    op.add_column("propiedades", sa.Column("tipo_actualizacion_id", sa.Integer(), nullable=True))
    op.create_foreign_key(
        "fk_propiedades_tipo_actualizacion_id", 
        "propiedades", 
        "tipos_actualizacion", 
        ["tipo_actualizacion_id"], 
        ["id"]
    )
    op.create_index("ix_propiedades_tipo_actualizacion_id", "propiedades", ["tipo_actualizacion_id"])
    
    # Agregar fecha_renovacion
    op.add_column("propiedades", sa.Column("fecha_renovacion", sa.Date(), nullable=True))


def downgrade():
    """Remove propietario_id, tipo_actualizacion_id, and fecha_renovacion from propiedades table"""
    
    # Eliminar fecha_renovacion
    op.drop_column("propiedades", "fecha_renovacion")
    
    # Eliminar FK y columna tipo_actualizacion_id
    op.drop_index("ix_propiedades_tipo_actualizacion_id", table_name="propiedades")
    op.drop_constraint("fk_propiedades_tipo_actualizacion_id", "propiedades", type_="foreignkey")
    op.drop_column("propiedades", "tipo_actualizacion_id")
    
    # Eliminar FK y columna propietario_id
    op.drop_index("ix_propiedades_propietario_id", table_name="propiedades")
    op.drop_constraint("fk_propiedades_propietario_id", "propiedades", type_="foreignkey")
    op.drop_column("propiedades", "propietario_id")