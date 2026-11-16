import importlib.util
from datetime import date
from decimal import Decimal
from pathlib import Path


MIGRATION_PATH = (
    Path(__file__).parents[1]
    / "alembic"
    / "versions"
    / "20261024_seed_erp_indice_icc.py"
)


def _load_migration():
    spec = importlib.util.spec_from_file_location("erp_indice_icc_seed", MIGRATION_PATH)
    assert spec is not None and spec.loader is not None
    module = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(module)
    return module


def test_icc_seed_contiene_todos_los_periodos_y_preserva_decimales() -> None:
    rows = _load_migration()._icc_seed()

    assert len(rows) == 57
    assert len({row["fecha"] for row in rows}) == 57
    assert rows[0]["fecha"] == date(2022, 1, 1)
    assert rows[0]["valor"] == Decimal("100")
    assert rows[-1]["fecha"] == date(2026, 9, 1)
    assert rows[-1]["valor"] == Decimal("1779.72267")
    assert {row["codigo"] for row in rows} == {"ICC"}
