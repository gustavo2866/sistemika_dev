"""add oportunidad fk to crm_mensajes

Revision ID: f8c734a461d2
Revises: d91b670bedfd
Create Date: 2025-11-27 10:33:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = "f8c734a461d2"
down_revision: Union[str, Sequence[str], None] = "d91b670bedfd"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Add oportunidad_id foreign key to crm_mensajes."""
    op.add_column(
        "crm_mensajes",
        sa.Column("oportunidad_id", sa.Integer(), nullable=True),
    )
    op.create_index(
        "ix_crm_mensajes_oportunidad_id",
        "crm_mensajes",
        ["oportunidad_id"],
        unique=False,
    )
    op.create_foreign_key(
        "fk_crm_mensajes_oportunidad_id",
        "crm_mensajes",
        "crm_oportunidades",
        ["oportunidad_id"],
        ["id"],
        ondelete="SET NULL",
    )

    # Populate existing rows using the opportunity linked to the related event.
    op.execute(
        """
        UPDATE crm_mensajes AS m
        SET oportunidad_id = e.oportunidad_id
        FROM crm_eventos AS e
        WHERE m.evento_id = e.id
          AND e.oportunidad_id IS NOT NULL
        """
    )


def downgrade() -> None:
    """Remove oportunidad_id foreign key from crm_mensajes."""
    op.drop_constraint(
        "fk_crm_mensajes_oportunidad_id",
        "crm_mensajes",
        type_="foreignkey",
    )
    op.drop_index(
        "ix_crm_mensajes_oportunidad_id",
        table_name="crm_mensajes",
    )
    op.drop_column("crm_mensajes", "oportunidad_id")
