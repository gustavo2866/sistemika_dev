"""add id_metodo_proyeccion to erp cash cuentas

Revision ID: 20261018_add_metodo_proyeccion_to_erp_cash_cuentas
Revises: 20261018_create_metodo_proyeccion
Create Date: 2026-10-18
"""

from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op


revision: str = "20261018_add_metodo_proyeccion_to_erp_cash_cuentas"
down_revision: Union[str, Sequence[str], None] = "20261018_create_metodo_proyeccion"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column(
        "erp_cash_cuentas",
        sa.Column("id_metodo_proyeccion", sa.Integer(), nullable=True),
    )
    op.create_foreign_key(
        "fk_erp_cash_cuentas_id_metodo_proyeccion_metodo_proyeccion",
        "erp_cash_cuentas",
        "metodo_proyeccion",
        ["id_metodo_proyeccion"],
        ["id"],
    )
    op.create_index(
        "ix_erp_cash_cuentas_id_metodo_proyeccion",
        "erp_cash_cuentas",
        ["id_metodo_proyeccion"],
    )


def downgrade() -> None:
    op.drop_index(
        "ix_erp_cash_cuentas_id_metodo_proyeccion",
        table_name="erp_cash_cuentas",
    )
    op.drop_constraint(
        "fk_erp_cash_cuentas_id_metodo_proyeccion_metodo_proyeccion",
        "erp_cash_cuentas",
        type_="foreignkey",
    )
    op.drop_column("erp_cash_cuentas", "id_metodo_proyeccion")
