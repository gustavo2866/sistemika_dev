"""seed_inmobiliaria_settings

Revision ID: 20260416_seed_inmobiliaria_settings
Revises: e3f1a2b4c5d6
Create Date: 2026-04-16
"""
from typing import Sequence, Union

from alembic import op


revision: str = "20260416_seed_inmobiliaria_settings"
down_revision: Union[str, Sequence[str], None] = "e3f1a2b4c5d6"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.execute(
        """
        INSERT INTO settings (created_at, updated_at, deleted_at, version, clave, valor, descripcion)
        VALUES (
            NOW(), NOW(), NULL, 1,
            'INM_Dias_Vencimiento',
            '60',
            'Dias de anticipacion para la alarma de vencimiento de contratos en inmobiliaria.'
        )
        ON CONFLICT (clave) DO UPDATE SET
            valor = EXCLUDED.valor,
            descripcion = EXCLUDED.descripcion,
            updated_at = NOW(),
            deleted_at = NULL
        """
    )
    op.execute(
        """
        INSERT INTO settings (created_at, updated_at, deleted_at, version, clave, valor, descripcion)
        VALUES (
            NOW(), NOW(), NULL, 1,
            'INM_Dias_Actualizacion',
            '60',
            'Dias de anticipacion para la alarma de cuota/fecha de actualizacion en inmobiliaria.'
        )
        ON CONFLICT (clave) DO UPDATE SET
            valor = EXCLUDED.valor,
            descripcion = EXCLUDED.descripcion,
            updated_at = NOW(),
            deleted_at = NULL
        """
    )


def downgrade() -> None:
    op.execute(
        "DELETE FROM settings WHERE clave IN ('INM_Dias_Vencimiento', 'INM_Dias_Actualizacion')"
    )
