"""seed initial ICC index values

Revision ID: 20261024_seed_icc
Revises: 20261024_erp_indice
Create Date: 2026-10-24
"""

from datetime import UTC, date, datetime
from decimal import Decimal
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


revision: str = "20261024_seed_icc"
down_revision: Union[str, Sequence[str], None] = "20261024_erp_indice"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


ICC_VALUES: tuple[tuple[str, str], ...] = (
    ("2022-01-01", "100"),
    ("2022-02-01", "103.809636"),
    ("2022-03-01", "108.957034"),
    ("2022-04-01", "111.477784"),
    ("2022-05-01", "118.877112"),
    ("2022-06-01", "126.709992"),
    ("2022-07-01", "135.483287"),
    ("2022-08-01", "145.610637"),
    ("2022-09-01", "156.442168"),
    ("2022-10-01", "167.839396"),
    ("2022-11-01", "179.137062"),
    ("2022-12-01", "186.865853"),
    ("2023-01-01", "199.350126"),
    ("2023-02-01", "211.370075"),
    ("2023-03-01", "221.314591"),
    ("2023-04-01", "239.206937"),
    ("2023-05-01", "257.819755"),
    ("2023-06-01", "272.845596"),
    ("2023-07-01", "295.711557"),
    ("2023-08-01", "339.438647"),
    ("2023-09-01", "389.213725"),
    ("2023-10-01", "416.986324"),
    ("2023-11-01", "465.072455"),
    ("2023-12-01", "607.6066"),
    ("2024-01-01", "702.60221"),
    ("2024-02-01", "747.937692"),
    ("2024-03-01", "808.761529"),
    ("2024-04-01", "847.370184"),
    ("2024-05-01", "939.090177"),
    ("2024-06-01", "968.871229"),
    ("2024-07-01", "986.73099"),
    ("2024-08-01", "1003.148"),
    ("2024-09-01", "1050.44486"),
    ("2024-10-01", "1062.73273"),
    ("2024-11-01", "1073.0755"),
    ("2024-12-01", "1165.88796"),
    ("2025-01-01", "1176.10764"),
    ("2025-02-01", "1201.91342"),
    ("2025-03-01", "1208.65291"),
    ("2025-04-01", "1214.67013"),
    ("2025-05-01", "1256.82956"),
    ("2025-06-01", "1269.3609"),
    ("2025-07-01", "1292.92923"),
    ("2025-08-01", "1315.49288"),
    ("2025-09-01", "1355.21121"),
    ("2025-10-01", "1377.86266"),
    ("2025-11-01", "1415.57887"),
    ("2025-12-01", "1436.49883"),
    ("2026-01-01", "1472.12874"),
    ("2026-02-01", "1501.6455"),
    ("2026-03-01", "1530.82737"),
    ("2026-04-01", "1590.91806"),
    ("2026-05-01", "1634.90763"),
    ("2026-06-01", "1675.35277"),
    ("2026-07-01", "1710.0305"),
    ("2026-08-01", "1753.38649"),
    ("2026-09-01", "1779.72267"),
)


def _icc_seed() -> list[dict[str, object]]:
    timestamp = datetime.now(UTC)
    return [
        {
            "created_at": timestamp,
            "updated_at": timestamp,
            "deleted_at": None,
            "version": 1,
            "codigo": "ICC",
            "fecha": date.fromisoformat(fecha),
            "valor": Decimal(valor),
        }
        for fecha, valor in ICC_VALUES
    ]


def upgrade() -> None:
    indice = sa.table(
        "erp_indice",
        sa.column("created_at", sa.DateTime(timezone=True)),
        sa.column("updated_at", sa.DateTime(timezone=True)),
        sa.column("deleted_at", sa.DateTime(timezone=True)),
        sa.column("version", sa.Integer()),
        sa.column("codigo", sa.String(length=3)),
        sa.column("fecha", sa.Date()),
        sa.column("valor", sa.DECIMAL(precision=18, scale=6)),
    )
    op.bulk_insert(indice, _icc_seed())


def downgrade() -> None:
    op.execute(
        sa.text(
            "DELETE FROM erp_indice "
            "WHERE codigo = 'ICC' "
            "AND fecha BETWEEN DATE '2022-01-01' AND DATE '2026-09-01'"
        )
    )
