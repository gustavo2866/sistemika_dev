"""add_fecha_egreso_nro_legajo_to_nominas

Revision ID: 20260530_add_fecha_egreso_nro_legajo_to_nominas
Revises: 20260526_channel_conversation_state_identity
Create Date: 2026-05-30

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa

# revision identifiers, used by Alembic.
revision: str = "20260530_add_fecha_egreso_nro_legajo_to_nominas"
down_revision: Union[str, None] = "20260526_channel_conversation_state_identity"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column("nominas", sa.Column("fecha_egreso", sa.Date(), nullable=True))
    op.add_column("nominas", sa.Column("nro_legajo", sa.String(length=10), nullable=True))


def downgrade() -> None:
    op.drop_column("nominas", "nro_legajo")
    op.drop_column("nominas", "fecha_egreso")
