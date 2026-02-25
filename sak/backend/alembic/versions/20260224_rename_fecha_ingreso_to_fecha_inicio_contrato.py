"""rename_fecha_ingreso_to_fecha_inicio_contrato_in_propiedades

Revision ID: 20260224_rename_fecha_ingreso_to_fecha_inicio_contrato
Revises: 20260224_add_propietario_renovacion_to_propiedades
Create Date: 2026-02-24 23:00:00.000000

"""
from alembic import op
import sqlalchemy as sa

# revision identifiers, used by Alembic.
revision = "20260224_rename_fecha_ingreso_to_fecha_inicio_contrato"
down_revision = "20260224_add_propietario_renovacion_to_propiedades"
branch_labels = None
depends_on = None


def upgrade():
    """Rename fecha_ingreso to fecha_inicio_contrato in propiedades table"""
    op.alter_column(
        "propiedades", 
        "fecha_ingreso",
        new_column_name="fecha_inicio_contrato"
    )


def downgrade():
    """Rename fecha_inicio_contrato back to fecha_ingreso in propiedades table"""
    op.alter_column(
        "propiedades", 
        "fecha_inicio_contrato",
        new_column_name="fecha_ingreso"
    )