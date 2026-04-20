"""convert vacancia and propiedad dates to date

Revision ID: 2b6cc3ddf3d1
Revises: 623274e44549
Create Date: 2025-11-18 12:00:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = '2b6cc3ddf3d1'
down_revision: Union[str, Sequence[str], None] = '623274e44549'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def _alter_columns_to_date(table: str, cols: list[dict]):
    """Helper to alter datetime columns to date using batch (works for SQLite/Postgres)."""
    with op.batch_alter_table(table, recreate="auto") as batch_op:
        for col in cols:
            batch_op.alter_column(
                col["name"],
                existing_type=sa.DateTime(),
                type_=sa.Date(),
                existing_nullable=col.get("nullable", True),
            )


def upgrade() -> None:
    _alter_columns_to_date(
        "vacancias",
        [
            {"name": "fecha_recibida", "nullable": True},
            {"name": "fecha_en_reparacion", "nullable": True},
            {"name": "fecha_disponible", "nullable": True},
            {"name": "fecha_alquilada", "nullable": True},
            {"name": "fecha_retirada", "nullable": True},
        ],
    )

    _alter_columns_to_date(
        "propiedades",
        [
            {"name": "estado_fecha", "nullable": False},
        ],
    )


def downgrade() -> None:
    # Revert back to DateTime if needed
    with op.batch_alter_table("vacancias", recreate="auto") as batch_op:
        for name in ["fecha_recibida", "fecha_en_reparacion", "fecha_disponible", "fecha_alquilada", "fecha_retirada"]:
            batch_op.alter_column(
                name,
                existing_type=sa.Date(),
                type_=sa.DateTime(),
                existing_nullable=True,
            )

    with op.batch_alter_table("propiedades", recreate="auto") as batch_op:
        batch_op.alter_column(
            "estado_fecha",
            existing_type=sa.Date(),
            type_=sa.DateTime(),
            existing_nullable=False,
        )
