"""create cash pendientes input table

Revision ID: 20261023_create_cash_pendientes_input
Revises: 20261023_create_erp_empresa
Create Date: 2026-10-23
"""

from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


revision: str = "20261023_create_cash_pendientes_input"
down_revision: Union[str, Sequence[str], None] = "20261023_create_erp_empresa"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table(
        "cash_pendientes_input",
        sa.Column("id", sa.Integer(), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("deleted_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("version", sa.Integer(), nullable=False, server_default=sa.text("1")),
        sa.Column("erp_empresa_id", sa.Integer(), nullable=False),
        sa.Column("uploaded_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("uploaded_by", sa.Integer(), nullable=True),
        sa.Column("source_name", sa.String(length=100), nullable=False, server_default="cash_pendientes"),
        sa.Column("file_name", sa.String(length=255), nullable=False),
        sa.Column("file_hash", sa.String(length=128), nullable=True),
        sa.Column("import_status", sa.String(length=30), nullable=False, server_default="pending"),
        sa.Column("validation_status", sa.String(length=30), nullable=False, server_default="pending"),
        sa.Column("row_number", sa.Integer(), nullable=False),
        sa.Column("tipcomp_raw", sa.String(length=50), nullable=True),
        sa.Column("nombre_raw", sa.String(length=255), nullable=True),
        sa.Column("sucursal_raw", sa.String(length=50), nullable=True),
        sa.Column("nrocomp_raw", sa.String(length=50), nullable=True),
        sa.Column("tipsub_raw", sa.String(length=50), nullable=True),
        sa.Column("nrosub_raw", sa.String(length=50), nullable=True),
        sa.Column("subs_descrip_raw", sa.String(length=255), nullable=True),
        sa.Column("fecvenc_raw", sa.String(length=30), nullable=True),
        sa.Column("fecpre_raw", sa.String(length=30), nullable=True),
        sa.Column("saldo_raw", sa.String(length=100), nullable=True),
        sa.Column("imp_ext_raw", sa.String(length=100), nullable=True),
        sa.Column("nrocta_raw", sa.String(length=50), nullable=True),
        sa.Column("descrip_raw", sa.Text(), nullable=True),
        sa.Column("is_valid", sa.Boolean(), nullable=False, server_default=sa.text("false")),
        sa.Column("validation_errors", sa.Text(), nullable=True),
        sa.Column("raw_row", sa.Text(), nullable=True),
        sa.ForeignKeyConstraint(["erp_empresa_id"], ["erp_empresas.id"]),
        sa.PrimaryKeyConstraint("id"),
    )

    op.create_index(
        "ix_cash_pendientes_input_erp_empresa_id",
        "cash_pendientes_input",
        ["erp_empresa_id"],
        unique=False,
    )
    op.create_index(
        "ix_cash_pendientes_input_uploaded_at",
        "cash_pendientes_input",
        ["uploaded_at"],
        unique=False,
    )
    op.create_index(
        "ix_cash_pendientes_input_import_status",
        "cash_pendientes_input",
        ["import_status"],
        unique=False,
    )
    op.create_index(
        "ix_cash_pendientes_input_validation_status",
        "cash_pendientes_input",
        ["validation_status"],
        unique=False,
    )
    op.create_index(
        "ix_cash_pendientes_input_row_number",
        "cash_pendientes_input",
        ["row_number"],
        unique=False,
    )
    op.create_index(
        "ix_cash_pendientes_input_file_hash",
        "cash_pendientes_input",
        ["file_hash"],
        unique=False,
    )
    op.create_index(
        "ix_cash_pendientes_input_empresa_file_name_row",
        "cash_pendientes_input",
        ["erp_empresa_id", "file_name", "row_number"],
        unique=False,
    )


def downgrade() -> None:
    op.drop_index(
        "ix_cash_pendientes_input_empresa_file_name_row",
        table_name="cash_pendientes_input",
    )
    op.drop_index("ix_cash_pendientes_input_file_hash", table_name="cash_pendientes_input")
    op.drop_index("ix_cash_pendientes_input_row_number", table_name="cash_pendientes_input")
    op.drop_index(
        "ix_cash_pendientes_input_validation_status",
        table_name="cash_pendientes_input",
    )
    op.drop_index("ix_cash_pendientes_input_import_status", table_name="cash_pendientes_input")
    op.drop_index("ix_cash_pendientes_input_uploaded_at", table_name="cash_pendientes_input")
    op.drop_index("ix_cash_pendientes_input_erp_empresa_id", table_name="cash_pendientes_input")
    op.drop_table("cash_pendientes_input")
