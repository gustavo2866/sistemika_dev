"""027_create_webhook_logs

Revision ID: 027_create_webhook_logs
Revises: 026_add_meta_fields
Create Date: 2025-12-18 00:00:02.000000

"""
from typing import Sequence, Union
from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

# revision identifiers, used by Alembic.
revision: str = '027_create_webhook_logs'
down_revision: Union[str, Sequence[str], None] = '026_add_meta_fields'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Create webhook_logs table."""
    op.create_table(
        'webhook_logs',
        sa.Column('id', sa.Integer(), nullable=False, autoincrement=True),
        sa.Column('created_at', sa.DateTime(timezone=True), nullable=False, server_default=sa.text('now()')),
        sa.Column('updated_at', sa.DateTime(timezone=True), nullable=False, server_default=sa.text('now()')),
        sa.Column('deleted_at', sa.DateTime(timezone=True), nullable=True),
        sa.Column('version', sa.Integer(), nullable=False, server_default='1'),
        sa.Column('evento', sa.String(length=100), nullable=False),
        sa.Column('payload', postgresql.JSON(astext_type=sa.Text()), nullable=False),
        sa.Column('response_status', sa.Integer(), nullable=True),
        sa.Column('error_message', sa.Text(), nullable=True),
        sa.Column('procesado', sa.Boolean(), nullable=False, server_default='false'),
        sa.Column('fecha_recepcion', sa.DateTime(timezone=True), nullable=False, server_default=sa.text('now()')),
        sa.PrimaryKeyConstraint('id')
    )
    
    # Create indexes
    op.create_index(op.f('ix_webhook_logs_evento'), 'webhook_logs', ['evento'], unique=False)
    op.create_index(op.f('ix_webhook_logs_procesado'), 'webhook_logs', ['procesado'], unique=False)
    op.create_index(op.f('ix_webhook_logs_fecha_recepcion'), 'webhook_logs', ['fecha_recepcion'], unique=False)
    op.create_index(op.f('ix_webhook_logs_deleted_at'), 'webhook_logs', ['deleted_at'], unique=False)


def downgrade() -> None:
    """Drop webhook_logs table."""
    op.drop_index(op.f('ix_webhook_logs_deleted_at'), table_name='webhook_logs')
    op.drop_index(op.f('ix_webhook_logs_fecha_recepcion'), table_name='webhook_logs')
    op.drop_index(op.f('ix_webhook_logs_procesado'), table_name='webhook_logs')
    op.drop_index(op.f('ix_webhook_logs_evento'), table_name='webhook_logs')
    op.drop_table('webhook_logs')
