"""allow null funcion in metodo proyeccion detalle

Revision ID: 20261018_allow_null_funcion_metodo_proyeccion
Revises: 20261018_add_metodo_proyeccion_to_erp_cash_cuentas
Create Date: 2026-10-18
"""

from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op


revision: str = "20261018_allow_null_funcion_metodo_proyeccion"
down_revision: Union[str, Sequence[str], None] = (
    "20261018_add_metodo_proyeccion_to_erp_cash_cuentas"
)
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.alter_column(
        "metodo_proyeccion_detalle",
        "funcion",
        existing_type=sa.String(length=20),
        nullable=True,
    )


def downgrade() -> None:
    op.execute(
        "UPDATE metodo_proyeccion_detalle SET funcion = 'PROMEDIO' WHERE funcion IS NULL"
    )
    op.alter_column(
        "metodo_proyeccion_detalle",
        "funcion",
        existing_type=sa.String(length=20),
        nullable=False,
    )
