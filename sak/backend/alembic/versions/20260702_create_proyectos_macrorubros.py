"""create proyectos macrorubros table

Revision ID: 20260702_create_proyectos_macrorubros
Revises: 20260628_parte_diario_confirmado_cerrado
Create Date: 2026-07-02
"""

from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


revision: str = "20260702_create_proyectos_macrorubros"
down_revision: Union[str, Sequence[str], None] = "20260628_parte_diario_confirmado_cerrado"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table(
        "proyectos_macrorubros",
        sa.Column("id", sa.Integer(), nullable=False),
        sa.Column("nombre", sa.String(length=120), nullable=False),
        sa.Column("activo", sa.Boolean(), nullable=False, server_default=sa.true()),
        sa.Column("created_at", sa.DateTime(), nullable=False),
        sa.Column("updated_at", sa.DateTime(), nullable=False),
        sa.Column("deleted_at", sa.DateTime(), nullable=True),
        sa.Column("version", sa.Integer(), nullable=False),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("nombre"),
    )
    op.create_index("ix_proyectos_macrorubros_nombre", "proyectos_macrorubros", ["nombre"])
    op.create_index("ix_proyectos_macrorubros_activo", "proyectos_macrorubros", ["activo"])

    op.execute(
        """
        INSERT INTO proyectos_macrorubros (nombre, activo, created_at, updated_at, version)
        VALUES
            ('albanileria', TRUE, NOW(), NOW(), 1),
            ('estructura', TRUE, NOW(), NOW(), 1),
            ('sanitarios', TRUE, NOW(), NOW(), 1)
        """
    )


def downgrade() -> None:
    op.drop_index("ix_proyectos_macrorubros_activo", table_name="proyectos_macrorubros")
    op.drop_index("ix_proyectos_macrorubros_nombre", table_name="proyectos_macrorubros")
    op.drop_table("proyectos_macrorubros")
