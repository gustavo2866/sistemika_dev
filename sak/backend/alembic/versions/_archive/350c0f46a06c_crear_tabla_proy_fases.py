"""Crear tabla proy_fases

Revision ID: 350c0f46a06c
Revises: 20260307_add_users_celular_id_fk
Create Date: 2026-03-12 06:20:59.934965

"""
from typing import Sequence, Union
from datetime import datetime, timezone

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = '350c0f46a06c'
down_revision: Union[str, Sequence[str], None] = '20260307_add_users_celular_id_fk'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Upgrade schema."""
    # Crear tabla proy_fases
    op.create_table('proy_fases',
        sa.Column('id', sa.Integer(), nullable=False, primary_key=True),
        sa.Column('created_at', sa.DateTime(), nullable=False, server_default=sa.func.now()),
        sa.Column('updated_at', sa.DateTime(), nullable=False, server_default=sa.func.now()),
        sa.Column('deleted_at', sa.DateTime(), nullable=True),
        sa.Column('version', sa.Integer(), nullable=False, server_default='1'),
        sa.Column('nombre', sa.String(100), nullable=False),
        sa.Column('orden', sa.Integer(), nullable=False),
        sa.Column('activo', sa.Boolean(), nullable=False, server_default='true'),
        sa.Column('descripcion', sa.String(500), nullable=True),
        sa.PrimaryKeyConstraint('id')
    )
    
    # Poblar datos iniciales
    proy_fases_table = sa.table('proy_fases',
        sa.Column('nombre', sa.String),
        sa.Column('orden', sa.Integer),
        sa.Column('activo', sa.Boolean),
        sa.Column('descripcion', sa.String),
        sa.Column('created_at', sa.DateTime),
        sa.Column('updated_at', sa.DateTime),
        sa.Column('version', sa.Integer)
    )
    
    now = datetime.now(timezone.utc)
    
    op.bulk_insert(proy_fases_table, [
        {'nombre': 'Trab Prelim', 'orden': 1, 'activo': True, 'descripcion': 'Trabajos Preliminares', 'created_at': now, 'updated_at': now, 'version': 1},
        {'nombre': 'Suelo', 'orden': 2, 'activo': True, 'descripcion': 'Trabajos de Suelo', 'created_at': now, 'updated_at': now, 'version': 1},
        {'nombre': 'Estructura', 'orden': 3, 'activo': True, 'descripcion': 'Estructura', 'created_at': now, 'updated_at': now, 'version': 1},
        {'nombre': 'Albañilería', 'orden': 4, 'activo': True, 'descripcion': 'Trabajos de Albañilería', 'created_at': now, 'updated_at': now, 'version': 1},
        {'nombre': 'Herrería', 'orden': 5, 'activo': True, 'descripcion': 'Trabajos de Herrería', 'created_at': now, 'updated_at': now, 'version': 1},
        {'nombre': 'Carpintería', 'orden': 6, 'activo': True, 'descripcion': 'Trabajos de Carpintería', 'created_at': now, 'updated_at': now, 'version': 1},
        {'nombre': 'Inst Sanitaria', 'orden': 7, 'activo': True, 'descripcion': 'Instalación Sanitaria', 'created_at': now, 'updated_at': now, 'version': 1},
        {'nombre': 'Yesería', 'orden': 8, 'activo': True, 'descripcion': 'Trabajos de Yesería', 'created_at': now, 'updated_at': now, 'version': 1},
        {'nombre': 'Inst Eléctrica', 'orden': 9, 'activo': True, 'descripcion': 'Instalación Eléctrica', 'created_at': now, 'updated_at': now, 'version': 1},
        {'nombre': 'Pintura', 'orden': 10, 'activo': True, 'descripcion': 'Trabajos de Pintura', 'created_at': now, 'updated_at': now, 'version': 1},
        {'nombre': 'Varios', 'orden': 11, 'activo': True, 'descripcion': 'Trabajos Varios', 'created_at': now, 'updated_at': now, 'version': 1},
        {'nombre': 'A Distribuir', 'orden': 12, 'activo': True, 'descripcion': 'Gastos a Distribuir', 'created_at': now, 'updated_at': now, 'version': 1},
    ])


def downgrade() -> None:
    """Downgrade schema."""
    op.drop_table('proy_fases')
