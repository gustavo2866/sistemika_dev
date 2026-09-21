"""update tarja_novedades unique constraint by nomina

Revision ID: 20260829_update_tarja_novedades_unique_nomina
Revises: 20260829_update_tarja_novedades_fields
Create Date: 2026-08-29
"""

from typing import Sequence, Union

from alembic import op


revision: str = "20260829_update_tarja_novedades_unique_nomina"
down_revision: Union[str, Sequence[str], None] = "20260829_update_tarja_novedades_fields"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.drop_constraint("uq_tarja_novedades_tarja", "tarja_novedades", type_="unique")
    op.create_unique_constraint(
        "uq_tarja_novedades_tarja_nomina",
        "tarja_novedades",
        ["tarja_id", "nomina_id"],
    )


def downgrade() -> None:
    op.drop_constraint("uq_tarja_novedades_tarja_nomina", "tarja_novedades", type_="unique")
    op.create_unique_constraint(
        "uq_tarja_novedades_tarja",
        "tarja_novedades",
        ["tarja_id"],
    )
