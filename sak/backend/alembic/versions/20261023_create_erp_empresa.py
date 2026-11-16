"""create erp empresa catalog

Revision ID: 20261023_create_erp_empresa
Revises: 20261019_allow_pend_erp_cash_proyectado
Create Date: 2026-10-23
"""

from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


revision: str = "20261023_create_erp_empresa"
down_revision: Union[str, Sequence[str], None] = "20261019_allow_pend_erp_cash_proyectado"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table(
        "erp_empresas",
        sa.Column("id", sa.Integer(), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("deleted_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("version", sa.Integer(), nullable=False, server_default=sa.text("1")),
        sa.Column("empresa_id", sa.Integer(), nullable=False),
        sa.Column("empresa_nombre", sa.String(length=255), nullable=False),
        sa.Column("grupo", sa.String(length=50), nullable=False, server_default="otros"),
        sa.PrimaryKeyConstraint("id"),
    )

    op.create_index("ix_erp_empresas_empresa_id", "erp_empresas", ["empresa_id"], unique=True)
    op.create_index("ix_erp_empresas_empresa_nombre", "erp_empresas", ["empresa_nombre"], unique=False)
    op.create_index("ix_erp_empresas_grupo", "erp_empresas", ["grupo"], unique=False)

    op.execute(
        """
        INSERT INTO erp_empresas (created_at, updated_at, version, empresa_id, empresa_nombre, grupo)
        VALUES
            (NOW(), NOW(), 1, 1, 'BATIA', 'wcl'),
            (NOW(), NOW(), 1, 2, 'NORFORK', 'wcl'),
            (NOW(), NOW(), 1, 3, 'GUARE', 'otros'),
            (NOW(), NOW(), 1, 4, 'TORRES', 'otros'),
            (NOW(), NOW(), 1, 5, 'WEROLICH', 'wcl')
        ON CONFLICT (empresa_id) DO NOTHING
        """
    )


def downgrade() -> None:
    op.drop_index("ix_erp_empresas_grupo", table_name="erp_empresas")
    op.drop_index("ix_erp_empresas_empresa_nombre", table_name="erp_empresas")
    op.drop_index("ix_erp_empresas_empresa_id", table_name="erp_empresas")
    op.drop_table("erp_empresas")
