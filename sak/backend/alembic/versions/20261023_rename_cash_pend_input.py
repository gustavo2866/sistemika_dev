"""rename cash pending input table to ERP cash naming

Revision ID: 20261023_rename_cash_pend_input
Revises: 20261023_create_cash_pendientes_input
Create Date: 2026-10-23
"""

from typing import Sequence, Union

from alembic import op


revision: str = "20261023_rename_cash_pend_input"
down_revision: Union[str, Sequence[str], None] = "20261023_create_cash_pendientes_input"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # En desarrollo, SQLModel.create_all pudo haber creado la tabla final fuera
    # del historial de Alembic. Solo se descarta si está vacía; con datos se
    # aborta para exigir una migración explícita de esos registros.
    op.execute(
        """
        DO $$
        BEGIN
            IF to_regclass('erp_cash_pendientes_input') IS NOT NULL THEN
                IF EXISTS (SELECT 1 FROM erp_cash_pendientes_input LIMIT 1) THEN
                    RAISE EXCEPTION
                        'erp_cash_pendientes_input existe fuera de Alembic y contiene datos';
                END IF;
                DROP TABLE erp_cash_pendientes_input;
            END IF;
        END
        $$;
        """
    )

    op.execute("ALTER TABLE cash_pendientes_input RENAME TO erp_cash_pendientes_input")

    op.execute(
        "ALTER INDEX ix_cash_pendientes_input_erp_empresa_id RENAME TO ix_erp_cash_pendientes_input_erp_empresa_id"
    )
    op.execute(
        "ALTER INDEX ix_cash_pendientes_input_uploaded_at RENAME TO ix_erp_cash_pendientes_input_uploaded_at"
    )
    op.execute(
        "ALTER INDEX ix_cash_pendientes_input_import_status RENAME TO ix_erp_cash_pendientes_input_import_status"
    )
    op.execute(
        "ALTER INDEX ix_cash_pendientes_input_validation_status RENAME TO ix_erp_cash_pendientes_input_validation_status"
    )
    op.execute(
        "ALTER INDEX ix_cash_pendientes_input_row_number RENAME TO ix_erp_cash_pendientes_input_row_number"
    )
    op.execute(
        "ALTER INDEX ix_cash_pendientes_input_file_hash RENAME TO ix_erp_cash_pendientes_input_file_hash"
    )
    op.execute(
        "ALTER INDEX ix_cash_pendientes_input_empresa_file_name_row RENAME TO ix_erp_cash_pendientes_input_empresa_file_name_row"
    )


def downgrade() -> None:
    op.execute(
        "ALTER INDEX ix_erp_cash_pendientes_input_empresa_file_name_row RENAME TO ix_cash_pendientes_input_empresa_file_name_row"
    )
    op.execute(
        "ALTER INDEX ix_erp_cash_pendientes_input_file_hash RENAME TO ix_cash_pendientes_input_file_hash"
    )
    op.execute(
        "ALTER INDEX ix_erp_cash_pendientes_input_row_number RENAME TO ix_cash_pendientes_input_row_number"
    )
    op.execute(
        "ALTER INDEX ix_erp_cash_pendientes_input_validation_status RENAME TO ix_cash_pendientes_input_validation_status"
    )
    op.execute(
        "ALTER INDEX ix_erp_cash_pendientes_input_import_status RENAME TO ix_cash_pendientes_input_import_status"
    )
    op.execute(
        "ALTER INDEX ix_erp_cash_pendientes_input_uploaded_at RENAME TO ix_cash_pendientes_input_uploaded_at"
    )
    op.execute(
        "ALTER INDEX ix_erp_cash_pendientes_input_erp_empresa_id RENAME TO ix_cash_pendientes_input_erp_empresa_id"
    )
    op.execute("ALTER TABLE erp_cash_pendientes_input RENAME TO cash_pendientes_input")
