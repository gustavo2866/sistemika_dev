"""add_po_order_status_log

Revision ID: 20260321_add_po_order_status_log
Revises: 200540588e7f
Create Date: 2026-03-21

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa
import sqlmodel

# revision identifiers, used by Alembic.
revision: str = '20260321_add_po_order_status_log'
down_revision: Union[str, Sequence[str], None] = '200540588e7f'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Upgrade schema."""
    op.create_table(
        'po_order_status_log',
        sa.Column('id', sa.Integer(), nullable=False),
        sa.Column('created_at', sa.DateTime(), nullable=False),
        sa.Column('updated_at', sa.DateTime(), nullable=False),
        sa.Column('deleted_at', sa.DateTime(), nullable=True),
        sa.Column('version', sa.Integer(), nullable=False),
        sa.Column('order_id', sa.Integer(), nullable=False),
        sa.Column('status_anterior_id', sa.Integer(), nullable=True),
        sa.Column('status_nuevo_id', sa.Integer(), nullable=False),
        sa.Column('usuario_id', sa.Integer(), nullable=False),
        sa.Column('comentario', sqlmodel.sql.sqltypes.AutoString(length=500), nullable=True),
        sa.Column('fecha_registro', sa.Date(), nullable=False),
        sa.ForeignKeyConstraint(['order_id'], ['po_orders.id'], ),
        sa.ForeignKeyConstraint(['status_anterior_id'], ['po_order_status.id'], ),
        sa.ForeignKeyConstraint(['status_nuevo_id'], ['po_order_status.id'], ),
        sa.ForeignKeyConstraint(['usuario_id'], ['users.id'], ),
        sa.PrimaryKeyConstraint('id'),
    )
    op.create_index(
        'ix_po_order_status_log_order_id',
        'po_order_status_log',
        ['order_id'],
    )


def downgrade() -> None:
    """Downgrade schema."""
    op.drop_index('ix_po_order_status_log_order_id', table_name='po_order_status_log')
    op.drop_table('po_order_status_log')
