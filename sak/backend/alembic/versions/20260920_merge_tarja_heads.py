"""merge tarja migration heads

Revision ID: 20260920_merge_tarja_heads
Revises: 20260906_make_nomina_dni_not_unique, 20260920_add_viaticos_to_tarjas
Create Date: 2026-09-20
"""

from typing import Sequence, Union

revision: str = "20260920_merge_tarja_heads"
down_revision: Union[str, Sequence[str], None] = (
    "20260906_make_nomina_dni_not_unique",
    "20260920_add_viaticos_to_tarjas",
)
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    pass


def downgrade() -> None:
    pass
