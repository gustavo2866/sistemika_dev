"""
Reporte por centro de costo para un periodo determinado.

Columnas del reporte:
- centro_costo
- egreso: suma de rubros distintos de "No definido" e "Ingresos"
- ingreso: suma de rubro "Ingresos"
- Los valores se muestran en millones.

Uso:
    cd backend
    python scripts/reporte_centro_costo_periodo.py --periodo 2026-01
"""

from __future__ import annotations

import argparse
import os
from pathlib import Path

import psycopg
from dotenv import load_dotenv


BACKEND_ROOT = Path(__file__).resolve().parents[1]
load_dotenv(BACKEND_ROOT / ".env")


QUERY = """
SELECT
    ld.centro_costo,
    COALESCE(
        SUM(
            CASE
                WHEN lower(COALESCE(r.nombre, '')) = 'ingresos' THEN 0
                WHEN lower(COALESCE(r.nombre, '')) = 'no definido' THEN 0
                ELSE COALESCE(ld.haber, 0) + COALESCE(ld.debe, 0)
            END
        ),
        0
    ) AS egreso,
    COALESCE(
        SUM(
            CASE
                WHEN lower(COALESCE(r.nombre, '')) = 'ingresos'
                    THEN COALESCE(ld.haber, 0) + COALESCE(ld.debe, 0)
                ELSE 0
            END
        ),
        0
    ) AS ingreso
FROM public.erp_libro_diario ld
LEFT JOIN public.erp_cuentas c
    ON c.nro_cuenta = ld.cuenta_codigo
LEFT JOIN public.erp_rubros r
    ON r.id = c.rubro_id
WHERE ld.periodo_anio = %s
  AND ld.periodo_mes = %s
GROUP BY ld.centro_costo
ORDER BY ingreso ASC, ld.centro_costo
"""


def parse_periodo(periodo: str) -> tuple[int, int]:
    value = periodo.strip()
    if "-" in value:
        parts = value.split("-")
        if len(parts) != 2:
            raise ValueError("Formato de periodo invalido. Usar YYYY-MM o YYYYMM.")
        anio, mes = parts
    else:
        if len(value) != 6 or not value.isdigit():
            raise ValueError("Formato de periodo invalido. Usar YYYY-MM o YYYYMM.")
        anio, mes = value[:4], value[4:]

    if not (anio.isdigit() and mes.isdigit()):
        raise ValueError("Formato de periodo invalido. Usar YYYY-MM o YYYYMM.")

    anio_num = int(anio)
    mes_num = int(mes)
    if anio_num < 2000 or anio_num > 2100:
        raise ValueError("Anio fuera de rango esperado (2000-2100).")
    if mes_num < 1 or mes_num > 12:
        raise ValueError("Mes fuera de rango (1-12).")
    return anio_num, mes_num


def get_database_url() -> str:
    url = os.getenv("DATABASE_URL")
    if not url:
        raise RuntimeError("DATABASE_URL no esta definida.")
    return url.replace("postgresql+psycopg://", "postgresql://")


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description="Reporte por centro de costo para un periodo")
    parser.add_argument(
        "--periodo",
        required=True,
        help="Periodo a consultar. Formatos aceptados: YYYY-MM o YYYYMM",
    )
    return parser.parse_args()


def main() -> None:
    args = parse_args()
    anio, mes = parse_periodo(args.periodo)

    print(f"Periodo: {anio:04d}-{mes:02d}")

    with psycopg.connect(get_database_url()) as conn:
        with conn.cursor() as cur:
            cur.execute(QUERY, (anio, mes))
            rows = cur.fetchall()

    print(f"Total centros de costo: {len(rows)}")
    print("| centro_costo | ingreso (MM) | egreso (MM) |")
    print("|---|---:|---:|")

    def to_millions(value: object) -> str:
        amount = float(value or 0) / 1_000_000
        return f"{amount:.2f}"

    for centro_costo, egreso, ingreso in rows:
        print(f"| {centro_costo} | {to_millions(ingreso)} | {to_millions(egreso)} |")


if __name__ == "__main__":
    main()
