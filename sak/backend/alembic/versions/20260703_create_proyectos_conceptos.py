"""create proyectos conceptos table

Revision ID: 20260703_create_proyectos_conceptos
Revises: 20260702_create_proyectos_macrorubros
Create Date: 2026-07-03
"""

from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


revision: str = "20260703_create_proyectos_conceptos"
down_revision: Union[str, Sequence[str], None] = "20260702_create_proyectos_macrorubros"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table(
        "proyectos_conceptos",
        sa.Column("id", sa.Integer(), nullable=False),
        sa.Column("nombre", sa.String(length=120), nullable=False),
        sa.Column("activo", sa.Boolean(), nullable=False, server_default=sa.true()),
        sa.Column("signo", sa.Integer(), nullable=False, server_default="1"),
        sa.Column("created_at", sa.DateTime(), nullable=False),
        sa.Column("updated_at", sa.DateTime(), nullable=False),
        sa.Column("deleted_at", sa.DateTime(), nullable=True),
        sa.Column("version", sa.Integer(), nullable=False),
        sa.CheckConstraint("signo IN (1, -1)", name="ck_proyectos_conceptos_signo"),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("nombre"),
    )
    op.create_index("ix_proyectos_conceptos_nombre", "proyectos_conceptos", ["nombre"])
    op.create_index("ix_proyectos_conceptos_activo", "proyectos_conceptos", ["activo"])

    op.execute(
        """
        INSERT INTO proyectos_conceptos (nombre, activo, signo, created_at, updated_at, version)
        VALUES
            ('certificado', TRUE, 1, NOW(), NOW(), 1),
            ('mo_propia', TRUE, -1, NOW(), NOW(), 1),
            ('mo_terceros', TRUE, -1, NOW(), NOW(), 1),
            ('herramientas', TRUE, -1, NOW(), NOW(), 1),
            ('direccion', TRUE, 1, NOW(), NOW(), 1)
        """
    )


def downgrade() -> None:
    op.drop_index("ix_proyectos_conceptos_activo", table_name="proyectos_conceptos")
    op.drop_index("ix_proyectos_conceptos_nombre", table_name="proyectos_conceptos")
    op.drop_table("proyectos_conceptos")
