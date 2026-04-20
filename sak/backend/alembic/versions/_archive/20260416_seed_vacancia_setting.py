"""seed_vacancia_setting

Revision ID: 20260416_seed_vacancia_setting
Revises: 20260416_seed_inmobiliaria_settings
Create Date: 2026-04-16
"""
from typing import Sequence, Union

from alembic import op


revision: str = "20260416_seed_vacancia_setting"
down_revision: Union[str, Sequence[str], None] = "20260416_seed_inmobiliaria_settings"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.execute(
        """
        INSERT INTO settings (created_at, updated_at, deleted_at, version, clave, valor, descripcion)
        VALUES (
            NOW(), NOW(), NULL, 1,
            'INM_Dias_Vacancia',
            '90',
            'Dias minimos de vacancia para disparar la alarma de vacancia prolongada en inmobiliaria.'
        )
        ON CONFLICT (clave) DO UPDATE SET
            valor = EXCLUDED.valor,
            descripcion = EXCLUDED.descripcion,
            updated_at = NOW(),
            deleted_at = NULL
        """
    )


def downgrade() -> None:
    op.execute("DELETE FROM settings WHERE clave = 'INM_Dias_Vacancia'")
