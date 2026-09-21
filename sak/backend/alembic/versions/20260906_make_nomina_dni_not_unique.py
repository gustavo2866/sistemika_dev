"""make nomina dni not unique

Revision ID: 20260906_make_nomina_dni_not_unique
Revises: 20260905_drop_activo_from_tarja_nomina
Create Date: 2026-09-06
"""

from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op


revision: str = "20260906_make_nomina_dni_not_unique"
down_revision: Union[str, Sequence[str], None] = "20260905_drop_activo_from_tarja_nomina"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def _dni_unique_index_names() -> set[str]:
    bind = op.get_bind()
    inspector = sa.inspect(bind)
    names: set[str] = set()
    for index in inspector.get_indexes("nominas"):
        if index.get("unique") and index.get("column_names") == ["dni"]:
            name = index.get("name")
            if name:
                names.add(name)
    return names


def _dni_unique_constraint_names() -> set[str]:
    bind = op.get_bind()
    inspector = sa.inspect(bind)
    names: set[str] = set()
    for constraint in inspector.get_unique_constraints("nominas"):
        if constraint.get("column_names") == ["dni"]:
            name = constraint.get("name")
            if name:
                names.add(name)
    return names


def _has_index(name: str) -> bool:
    bind = op.get_bind()
    inspector = sa.inspect(bind)
    return any(index.get("name") == name for index in inspector.get_indexes("nominas"))


def upgrade() -> None:
    for constraint_name in _dni_unique_constraint_names():
        op.drop_constraint(constraint_name, "nominas", type_="unique")

    for index_name in _dni_unique_index_names() | {"ix_nominas_dni"}:
        if _has_index(index_name):
            op.drop_index(index_name, table_name="nominas")

    if not _has_index("ix_nominas_dni"):
        op.create_index("ix_nominas_dni", "nominas", ["dni"], unique=False)


def downgrade() -> None:
    if _has_index("ix_nominas_dni"):
        op.drop_index("ix_nominas_dni", table_name="nominas")
    op.create_index("ix_nominas_dni", "nominas", ["dni"], unique=True)
