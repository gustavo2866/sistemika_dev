"""create_tax_profiles_and_details

Revision ID: 1ebdf3b06e7b
Revises: 7ebbe12eb398
Create Date: 2026-02-12 08:29:38.896881

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = '1ebdf3b06e7b'
down_revision: Union[str, Sequence[str], None] = '7ebbe12eb398'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Upgrade schema."""
    # Crear tabla tax_profiles
    op.create_table(
        'tax_profiles',
        sa.Column('id', sa.Integer(), nullable=False, autoincrement=True),
        sa.Column('created_at', sa.DateTime(timezone=True), nullable=False, server_default=sa.text('now()')),
        sa.Column('updated_at', sa.DateTime(timezone=True), nullable=False, server_default=sa.text('now()')),
        sa.Column('deleted_at', sa.DateTime(timezone=True), nullable=True),
        sa.Column('version', sa.Integer(), nullable=False, server_default='1'),
        sa.Column('nombre', sa.String(length=255), nullable=False),
        sa.Column('descripcion', sa.String(length=500), nullable=True),
        sa.Column('activo', sa.Boolean(), nullable=False, server_default='true'),
        sa.Column('created_by_id', sa.Integer(), nullable=True),
        sa.Column('updated_by_id', sa.Integer(), nullable=True),
        sa.ForeignKeyConstraint(['created_by_id'], ['users.id'], ),
        sa.ForeignKeyConstraint(['updated_by_id'], ['users.id'], ),
        sa.PrimaryKeyConstraint('id')
    )
    
    # Crear índices para tax_profiles
    op.create_index(op.f('ix_tax_profiles_deleted_at'), 'tax_profiles', ['deleted_at'], unique=False)
    op.create_index(op.f('ix_tax_profiles_nombre'), 'tax_profiles', ['nombre'], unique=False)
    
    # Crear tabla tax_profile_details
    op.create_table(
        'tax_profile_details',
        sa.Column('id', sa.Integer(), nullable=False, autoincrement=True),
        sa.Column('created_at', sa.DateTime(timezone=True), nullable=False, server_default=sa.text('now()')),
        sa.Column('updated_at', sa.DateTime(timezone=True), nullable=False, server_default=sa.text('now()')),
        sa.Column('deleted_at', sa.DateTime(timezone=True), nullable=True),
        sa.Column('version', sa.Integer(), nullable=False, server_default='1'),
        sa.Column('profile_id', sa.Integer(), nullable=False),
        sa.Column('concepto_id', sa.Integer(), nullable=False),
        sa.Column('porcentaje', sa.DECIMAL(precision=5, scale=2), nullable=False),
        sa.Column('descripcion', sa.String(length=255), nullable=True),
        sa.Column('activo', sa.Boolean(), nullable=False, server_default='true'),
        sa.Column('fecha_vigencia', sa.Date(), nullable=False),
        sa.Column('created_by_id', sa.Integer(), nullable=True),
        sa.Column('updated_by_id', sa.Integer(), nullable=True),
        sa.ForeignKeyConstraint(['concepto_id'], ['adm_conceptos.id'], ),
        sa.ForeignKeyConstraint(['created_by_id'], ['users.id'], ),
        sa.ForeignKeyConstraint(['profile_id'], ['tax_profiles.id'], ),
        sa.ForeignKeyConstraint(['updated_by_id'], ['users.id'], ),
        sa.PrimaryKeyConstraint('id')
    )
    
    # Crear índices para tax_profile_details
    op.create_index(op.f('ix_tax_profile_details_deleted_at'), 'tax_profile_details', ['deleted_at'], unique=False)
    op.create_index(op.f('ix_tax_profile_details_profile_id'), 'tax_profile_details', ['profile_id'], unique=False)


def downgrade() -> None:
    """Downgrade schema."""
    # Simplemente eliminar las tablas (los índices se eliminan automáticamente)
    op.drop_table('tax_profile_details')
    op.drop_table('tax_profiles')
