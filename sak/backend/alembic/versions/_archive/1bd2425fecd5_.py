"""empty message

Revision ID: 1bd2425fecd5
Revises: 20260110_add_articulo_id_to_po_factura_detalles, 20260110_remove_registrado_por_from_facturas, 20260111_add_adm_conceptos
Create Date: 2026-01-11 12:56:14.686717

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = '1bd2425fecd5'
down_revision: Union[str, Sequence[str], None] = ('20260110_add_articulo_id_to_po_factura_detalles', '20260110_remove_registrado_por_from_facturas', '20260111_add_adm_conceptos')
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Upgrade schema."""
    pass


def downgrade() -> None:
    """Downgrade schema."""
    pass
