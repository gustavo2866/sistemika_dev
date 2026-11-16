#!/usr/bin/env python
"""Sincroniza erp_libro_mayor por un rango mensual desde el ERP original.

Por defecto procesa desde 202401 hasta 202609, ambos inclusive.

Uso:
    python scripts/sync_erp_libro_mayor.py
    python scripts/sync_erp_libro_mayor.py --desde 202401 --hasta 202609
"""

from __future__ import annotations

import argparse
import sys
from pathlib import Path

from sqlmodel import Session


BACKEND_ROOT = Path(__file__).resolve().parents[1]
if str(BACKEND_ROOT) not in sys.path:
    sys.path.insert(0, str(BACKEND_ROOT))

from app.db import engine  # noqa: E402
from app.models.erp.libro_diario_sync import parse_periodo  # noqa: E402
from app.models.erp.libro_mayor_sync import sync_libro_mayor_periodo  # noqa: E402


DEFAULT_DESDE = "202401"
DEFAULT_HASTA = "202609"


def iter_periodos(desde: str, hasta: str) -> list[str]:
    anio_desde, mes_desde = parse_periodo(desde)
    anio_hasta, mes_hasta = parse_periodo(hasta)
    start_index = anio_desde * 12 + mes_desde - 1
    end_index = anio_hasta * 12 + mes_hasta - 1
    if end_index < start_index:
        raise ValueError("hasta debe ser mayor o igual a desde")

    return [
        f"{month_index // 12:04d}{month_index % 12 + 1:02d}"
        for month_index in range(start_index, end_index + 1)
    ]


def parse_args(argv: list[str] | None = None) -> argparse.Namespace:
    parser = argparse.ArgumentParser(
        description="Sincroniza erp_libro_mayor desde la base ERP original",
    )
    parser.add_argument(
        "--desde",
        default=DEFAULT_DESDE,
        help="Primer periodo inclusive, en formato YYYYMM o YYYY-MM",
    )
    parser.add_argument(
        "--hasta",
        default=DEFAULT_HASTA,
        help="Ultimo periodo inclusive, en formato YYYYMM o YYYY-MM",
    )
    return parser.parse_args(argv)


def main() -> None:
    args = parse_args()
    try:
        periodos = iter_periodos(args.desde, args.hasta)
    except ValueError as exc:
        raise SystemExit(str(exc)) from exc

    total_leidos = 0
    total_eliminados = 0
    total_insertados = 0

    print(
        f"Sincronizando libro mayor: {periodos[0]} a {periodos[-1]} "
        f"({len(periodos)} periodos)"
    )
    with Session(engine) as session:
        for index, periodo in enumerate(periodos, start=1):
            print(f"[{index}/{len(periodos)}] Procesando {periodo}...")
            result = sync_libro_mayor_periodo(session, periodo)
            total_leidos += int(result["rows_read"])
            total_eliminados += int(result["rows_deleted"])
            total_insertados += int(result["rows_inserted"])
            print(
                f"  {result['periodo']}: leidos={result['rows_read']}, "
                f"eliminados={result['rows_deleted']}, "
                f"insertados={result['rows_inserted']}"
            )

    print(
        "Sincronizacion finalizada: "
        f"periodos={len(periodos)}, leidos={total_leidos}, "
        f"eliminados={total_eliminados}, insertados={total_insertados}"
    )


if __name__ == "__main__":
    main()
