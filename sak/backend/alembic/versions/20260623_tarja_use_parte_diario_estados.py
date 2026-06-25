"""tarja_use_parte_diario_estados

Revision ID: 20260623_tarja_use_parte_diario_estados
Revises: 20260622_create_tarja_tables
Create Date: 2026-06-23

"""
from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op

revision: str = "20260623_tarja_use_parte_diario_estados"
down_revision: Union[str, None] = "20260622_create_tarja_tables"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    bind = op.get_bind()
    inspector = sa.inspect(bind)

    has_tarja_estados = inspector.has_table("tarja_estados")
    if has_tarja_estados:
        # Copiar referencias por abreviatura cuando existan estados equivalentes
        op.execute(
            """
            UPDATE tarja_detalles td
            SET idestado = pde.id
            FROM tarja_estados te
            JOIN parte_diario_estados pde
              ON pde.abreviatura = te.abreviatura
            WHERE td.idestado = te.id
            """
        )

    fk_to_drop = None
    for fk in inspector.get_foreign_keys("tarja_detalles"):
        if fk.get("constrained_columns") == ["idestado"]:
            fk_to_drop = fk.get("name")
            break

    if fk_to_drop:
        op.drop_constraint(fk_to_drop, "tarja_detalles", type_="foreignkey")

    op.create_foreign_key(
        "tarja_detalles_idestado_fkey",
        "tarja_detalles",
        "parte_diario_estados",
        ["idestado"],
        ["id"],
    )

    if has_tarja_estados:
        idx_names = {idx["name"] for idx in inspector.get_indexes("tarja_estados")}
        if "ix_tarja_estados_abreviatura" in idx_names:
            op.drop_index("ix_tarja_estados_abreviatura", table_name="tarja_estados")
        op.drop_table("tarja_estados")


def downgrade() -> None:
    op.create_table(
        "tarja_estados",
        sa.Column("id", sa.Integer(), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("deleted_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("version", sa.Integer(), nullable=False, server_default="1"),
        sa.Column("abreviatura", sa.String(length=10), nullable=False),
        sa.Column("nombre", sa.String(length=100), nullable=False),
        sa.Column("activo", sa.Boolean(), nullable=False, server_default="true"),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index("ix_tarja_estados_abreviatura", "tarja_estados", ["abreviatura"], unique=True)

    op.drop_constraint(
        "tarja_detalles_idestado_fkey",
        "tarja_detalles",
        type_="foreignkey",
    )
    op.create_foreign_key(
        "tarja_detalles_idestado_fkey",
        "tarja_detalles",
        "tarja_estados",
        ["idestado"],
        ["id"],
    )
