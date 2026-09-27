from __future__ import annotations

import csv
import os
from decimal import Decimal, InvalidOperation
from pathlib import Path

import psycopg
from dotenv import load_dotenv

BACKEND_ROOT = Path(__file__).resolve().parents[1]
load_dotenv(BACKEND_ROOT / ".env")


def normalize_rubro(value: str | None) -> str:
    if value is None:
        return ""
    normalized = " ".join(value.strip().split())
    normalized = normalized.replace(" - ", "-").replace(" -", "-").replace("- ", "-")
    return normalized.upper()


def get_source_connection_kwargs() -> dict[str, str]:
    host = os.getenv("ERP_SOURCE_DB_HOST")
    dbname = os.getenv("ERP_SOURCE_DB_NAME")
    user = os.getenv("ERP_SOURCE_DB_USER")
    password = os.getenv("NEON_DB_PASSWORD") or os.getenv("ERP_SOURCE_DB_PASSWORD")

    if not (host and dbname and user and password):
        raise RuntimeError(
            "Faltan variables ERP_SOURCE_DB_HOST / ERP_SOURCE_DB_NAME / ERP_SOURCE_DB_USER / NEON_DB_PASSWORD"
        )

    return {
        "host": host,
        "dbname": dbname,
        "user": user,
        "password": password,
        "sslmode": os.getenv("ERP_SOURCE_SSLMODE", "require"),
    }


def _asiento_key(row: dict) -> tuple:
    return (
        row.get("empresa_id"),
        row.get("fecha"),
        str(row.get("tipo_asiento") or ""),
        str(row.get("nro_asiento") or ""),
    )


def _has_value(value: object) -> bool:
    try:
        return Decimal(str(value or 0)) != 0
    except InvalidOperation:
        return False


def enrich_cash_fields(rows: list[dict]) -> list[dict]:
    cash_accounts_by_asiento: dict[
        tuple,
        dict[str, set[tuple[object, str | None]]],
    ] = {}

    for row in rows:
        key = _asiento_key(row)
        rubro = normalize_rubro(row.get("rubro") or row.get("rubro_raw") or "")
        if rubro != "01-DISPONIBILIDADES":
            continue

        accounts = cash_accounts_by_asiento.setdefault(
            key,
            {"debe": set(), "haber": set()},
        )
        cuenta_codigo = row.get("cuenta_codigo")
        cuenta_nombre = row.get("cuenta_nombre")
        cuenta_cash = (
            cuenta_codigo,
            str(cuenta_nombre) if cuenta_nombre is not None else None,
        )
        if cuenta_codigo is not None and _has_value(row.get("debe")):
            accounts["debe"].add(cuenta_cash)
        if cuenta_codigo is not None and _has_value(row.get("haber")):
            accounts["haber"].add(cuenta_cash)

    for key, accounts in cash_accounts_by_asiento.items():
        for side in ("debe", "haber"):
            if len(accounts[side]) > 1:
                raise ValueError(
                    f"El asiento {key} tiene mÃ¡s de una cuenta de disponibilidades al {side}."
                )

    for row in rows:
        accounts = cash_accounts_by_asiento.get(_asiento_key(row))
        row["cash"] = "SI" if accounts is not None else "NO"
        row["cuenta_cash_id"] = None
        row["cuenta_cash_nombre"] = None

        if accounts is None:
            continue

        cash_account = None
        if _has_value(row.get("haber")):
            cash_account = next(iter(accounts["debe"]), None)
        elif _has_value(row.get("debe")):
            cash_account = next(iter(accounts["haber"]), None)

        if cash_account is not None:
            row["cuenta_cash_id"], row["cuenta_cash_nombre"] = cash_account

    return rows


def export_periodo(anio: int, mes: int, output_dir: Path | None = None) -> Path:
    output_dir = output_dir or BACKEND_ROOT / "data"
    output_dir.mkdir(parents=True, exist_ok=True)

    filename = f"erp_libro_diario_{anio:04d}_{mes:02d}_enriched.csv"
    output_path = output_dir / filename

    query = """
        WITH normalized AS (
            SELECT
                ld.id,
                ld.empresa_id,
                ld.fecha,
                ld.periodo_anio,
                ld.periodo_mes,
                ld.tipo_asiento,
                ld.nro_asiento,
                ld.nro_renglon,
                ld.cuenta_codigo,
                ld.debe,
                ld.haber,
                ld.descripcion,
                ld.tipo_subcuenta,
                ld.nro_subcuenta,
                ld.centro_costo,
                ld.cargado_en,
                ld.archivo_origen,
                dc.rubro AS rubro_raw,
                dc.nombre AS cuenta_nombre,
                -COALESCE(ld.haber, 0)::numeric AS ingreso,
                COALESCE(ld.debe, 0)::numeric AS egreso
            FROM public.libro_diario ld
            LEFT JOIN public.dim_cuenta dc ON dc.nro_cta = ld.cuenta_codigo
            WHERE ld.periodo_anio = %s
              AND ld.periodo_mes = %s
        )
        SELECT
            id,
            empresa_id,
            fecha,
            periodo_anio,
            periodo_mes,
            tipo_asiento,
            nro_asiento,
            nro_renglon,
            cuenta_codigo,
            debe,
            haber,
            ingreso,
            egreso,
            descripcion,
            tipo_subcuenta,
            nro_subcuenta,
            centro_costo,
            cargado_en,
            archivo_origen,
            rubro_raw AS rubro,
            cuenta_nombre
        FROM normalized
        ORDER BY id
    """

    columns = [
        "id",
        "empresa_id",
        "fecha",
        "periodo_anio",
        "periodo_mes",
        "tipo_asiento",
        "nro_asiento",
        "nro_renglon",
        "cuenta_codigo",
        "debe",
        "haber",
        "ingreso",
        "egreso",
        "descripcion",
        "tipo_subcuenta",
        "nro_subcuenta",
        "centro_costo",
        "cargado_en",
        "archivo_origen",
        "rubro",
        "cash",
        "cuenta_cash_id",
        "cuenta_cash_nombre",
    ]

    with psycopg.connect(**get_source_connection_kwargs()) as conn, conn.cursor() as cur:
        cur.execute(query, (anio, mes))
        rows = [
            dict(zip([desc.name for desc in cur.description], row))
            for row in cur.fetchall()
        ]

    rows = enrich_cash_fields(rows)

    with output_path.open("w", encoding="utf-8", newline="") as csvfile:
        writer = csv.writer(csvfile)
        writer.writerow(columns)
        for row in rows:
            writer.writerow([row.get(col) for col in columns])

    return output_path


if __name__ == "__main__":
    import argparse

    parser = argparse.ArgumentParser(description="Exporta el libro diario ERP a CSV completo con rubro y cash por línea.")
    parser.add_argument("anio", type=int, help="Año, por ejemplo 2026")
    parser.add_argument("mes", type=int, help="Mes, entre 1 y 12")
    parser.add_argument(
        "--output-dir",
        type=Path,
        default=BACKEND_ROOT / "data",
        help="Directorio de salida (por defecto backend/data)",
    )
    args = parser.parse_args()

    if not 1 <= args.mes <= 12:
        raise SystemExit("El mes debe estar entre 1 y 12.")

    output_path = export_periodo(args.anio, args.mes, args.output_dir)
    print(f"CSV enriquecido exportado: {output_path}")
    with output_path.open("r", encoding="utf-8") as fh:
        filas = sum(1 for _ in fh) - 1
    print(f"Filas exportadas: {filas}")
