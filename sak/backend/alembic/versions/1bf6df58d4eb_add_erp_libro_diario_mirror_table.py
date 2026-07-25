"""add erp_libro_diario mirror table

Revision ID: 1bf6df58d4eb
Revises: 20260724_drop_proy_fases
Create Date: 2026-07-24 07:33:59.793909

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa

# revision identifiers, used by Alembic.
revision: str = "1bf6df58d4eb"
down_revision: Union[str, Sequence[str], None] = "20260724_drop_proy_fases"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Upgrade schema."""
    op.create_table(
        "erp_libro_diario",
        sa.Column("id", sa.Integer(), nullable=False),
        sa.Column("created_at", sa.DateTime(), nullable=False),
        sa.Column("updated_at", sa.DateTime(), nullable=False),
        sa.Column("deleted_at", sa.DateTime(), nullable=True),
        sa.Column("version", sa.Integer(), nullable=False),
        sa.Column("source_id", sa.BigInteger(), nullable=False),
        sa.Column("empresa_id", sa.Integer(), nullable=False),
        sa.Column("fecha", sa.Date(), nullable=False),
        sa.Column("periodo_anio", sa.SmallInteger(), nullable=False),
        sa.Column("periodo_mes", sa.SmallInteger(), nullable=False),
        sa.Column("tipo_asiento", sa.String(length=255), nullable=True),
        sa.Column("nro_asiento", sa.String(length=255), nullable=True),
        sa.Column("nro_renglon", sa.String(length=255), nullable=True),
        sa.Column("cuenta_codigo", sa.Integer(), nullable=False),
        sa.Column("debe", sa.Numeric(), server_default="0", nullable=False),
        sa.Column("haber", sa.Numeric(), server_default="0", nullable=False),
        sa.Column("descripcion", sa.Text(), nullable=True),
        sa.Column("tipo_subcuenta", sa.String(length=255), nullable=True),
        sa.Column("nro_subcuenta", sa.String(length=255), nullable=True),
        sa.Column("centro_costo", sa.String(length=255), nullable=True),
        sa.Column("cargado_en", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.Column("archivo_origen", sa.String(length=255), nullable=True),
        sa.PrimaryKeyConstraint("id"),
    )

    op.create_index("ix_erp_libro_diario_source_id", "erp_libro_diario", ["source_id"], unique=True)
    op.create_index("idx_erp_libro_diario_cuenta", "erp_libro_diario", ["cuenta_codigo"], unique=False)
    op.create_index(
        "idx_erp_libro_diario_empresa_periodo",
        "erp_libro_diario",
        ["empresa_id", "periodo_anio", "periodo_mes"],
        unique=False,
    )


def downgrade() -> None:
    """Downgrade schema."""
    op.drop_index("idx_erp_libro_diario_empresa_periodo", table_name="erp_libro_diario")
    op.drop_index("idx_erp_libro_diario_cuenta", table_name="erp_libro_diario")
    op.drop_index("ix_erp_libro_diario_source_id", table_name="erp_libro_diario")
    op.drop_table("erp_libro_diario")
