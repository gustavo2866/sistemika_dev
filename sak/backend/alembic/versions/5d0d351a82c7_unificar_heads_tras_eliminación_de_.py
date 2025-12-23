"""Unificar heads tras eliminación de CRMOrigenLead

Revision ID: 5d0d351a82c7
Revises: 20251219_remove_crm_origen_lead, 028_allow_null_propiedad_id
Create Date: 2025-12-19 18:10:17.872569

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = '5d0d351a82c7'
down_revision: Union[str, Sequence[str], None] = ('20251219_remove_crm_origen_lead', '028_allow_null_propiedad_id')
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Upgrade schema."""
    pass


def downgrade() -> None:
    """Downgrade schema."""
    pass
