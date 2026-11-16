from __future__ import annotations

import re
from pathlib import Path

from sqlalchemy import create_engine, text

ROOT = Path(__file__).resolve().parents[1]

TARGET_TABLES = [
    "erp_rubros",
    "erp_cuenta_tipos",
    "erp_cuentas",
    "erp_presupuestos",
]


def read_db_url(path: Path) -> str:
    content = path.read_text(encoding="utf-8")
    match = re.search(r"^DATABASE_URL\s*=\s*(.+)$", content, flags=re.MULTILINE)
    if not match:
        raise RuntimeError(f"DATABASE_URL not found in {path}")
    return match.group(1).strip().strip('"').strip("'")


def get_columns(conn, table_name: str) -> list[str]:
    rows = conn.execute(
        text(
            """
            SELECT column_name
            FROM information_schema.columns
            WHERE table_schema = 'public' AND table_name = :table_name
            ORDER BY ordinal_position
            """
        ),
        {"table_name": table_name},
    ).fetchall()
    return [row[0] for row in rows]


def table_exists(conn, table_name: str) -> bool:
    row = conn.execute(
        text("SELECT to_regclass(:table_name) IS NOT NULL"),
        {"table_name": f"public.{table_name}"},
    ).scalar()
    return bool(row)


def summarize_table(conn, table_name: str) -> dict:
    if not table_exists(conn, table_name):
        return {"exists": False, "rows": 0}
    result = conn.execute(
        text(
            f"""
            SELECT COUNT(*) AS rows
            FROM public.{table_name}
            """
        )
    ).mappings().first()
    return {"exists": True, "rows": int(result["rows"]) if result else 0}


def sync_table(prod_conn, test_conn, table_name: str) -> dict:
    if not table_exists(prod_conn, table_name):
        return {"table": table_name, "status": "skipped_missing_in_prod", "rows": 0}

    columns = get_columns(prod_conn, table_name)
    quoted_cols = ", ".join(f'"{c}"' for c in columns)
    sql = text(f"SELECT {quoted_cols} FROM public.{table_name}")
    rows = prod_conn.execute(sql).fetchall()

    if rows:
        test_conn.execute(text(f'TRUNCATE TABLE public."{table_name}" RESTART IDENTITY CASCADE'))
        insert_sql = text(
            f"INSERT INTO public.{table_name} ({quoted_cols}) VALUES ({', '.join(f':{c}' for c in columns)})"
        )
        payload = [dict(zip(columns, row)) for row in rows]
        test_conn.execute(insert_sql, payload)
        test_conn.commit()
        return {"table": table_name, "status": "synced", "rows": len(rows)}

    test_conn.execute(text(f'TRUNCATE TABLE public."{table_name}" RESTART IDENTITY CASCADE'))
    test_conn.commit()
    return {"table": table_name, "status": "cleared_empty", "rows": 0}


def compare_totals(prod_conn, test_conn) -> dict:
    total_sql = text(
        """
        SELECT
            COUNT(*) AS rows,
            COALESCE(SUM(egreso), 0)::numeric AS egreso,
            COALESCE(SUM(ingres), 0)::numeric AS ingres,
            COALESCE(SUM(real_egreso), 0)::numeric AS real_egreso,
            COALESCE(SUM(real_ingreso), 0)::numeric AS real_ingreso
        FROM public.erp_presupuestos
        """
    )
    prod_summary = prod_conn.execute(total_sql).mappings().first()
    test_summary = test_conn.execute(total_sql).mappings().first()

    return {
        "prod": dict(prod_summary),
        "test": dict(test_summary),
    }


def main() -> None:
    prod_url = read_db_url(ROOT / ".env.production.local")
    test_url = read_db_url(ROOT / ".env")

    print("[SYNC] Production URL loaded from .env.production.local")
    print("[SYNC] Test URL loaded from .env")
    print("[SYNC] Tables to sync:", TARGET_TABLES)

    prod_engine = create_engine(prod_url, pool_pre_ping=True)
    test_engine = create_engine(test_url, pool_pre_ping=True)

    with prod_engine.connect() as prod_conn, test_engine.connect() as test_conn:
        print("\n[SYNC] Starting propagation from production to test...")
        for table_name in TARGET_TABLES:
            result = sync_table(prod_conn, test_conn, table_name)
            print(f"[SYNC] {result}")

        print("\n[SYNC] Comparing final budget totals...")
        totals = compare_totals(prod_conn, test_conn)
        print(f"[SYNC] PROD: {totals['prod']}")
        print(f"[SYNC] TEST: {totals['test']}")

        prod_total = totals["prod"]["rows"]
        test_total = totals["test"]["rows"]
        prod_egreso = totals["prod"]["egreso"]
        test_egreso = totals["test"]["egreso"]

        if prod_total == test_total and str(prod_egreso) == str(test_egreso):
            print("\n[SUCCESS] ERP budget tables in test match production for the synchronized scope.")
        else:
            print("\n[WARN] Totals do not fully match yet; inspect the imported data and rerun if needed.")


if __name__ == "__main__":
    main()
