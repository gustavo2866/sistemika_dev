import argparse
import os
from pathlib import Path
from typing import Any

from sqlalchemy import create_engine, text


def print_section(title: str) -> None:
    print("\n" + "=" * 72)
    print(title)
    print("=" * 72)


def print_rows(rows: list[tuple[Any, ...]]) -> None:
    if not rows:
        print("(sin filas)")
        return
    for row in rows:
        print(row)


def main() -> None:
    parser = argparse.ArgumentParser(
        description="Diagnostico de facturacion por OC/Factura (solo lectura)."
    )
    parser.add_argument("--order-id", type=int, default=18, help="ID de la OC")
    parser.add_argument("--invoice-id", type=int, default=13, help="ID de la factura")
    args = parser.parse_args()

    def load_db_url_from_env_file() -> str | None:
        env_path = Path(__file__).resolve().parents[1] / ".env"
        if not env_path.exists():
            return None
        try:
            for raw_line in env_path.read_text(encoding="utf-8").splitlines():
                line = raw_line.strip()
                if not line or line.startswith("#"):
                    continue
                if "=" not in line:
                    continue
                key, value = line.split("=", 1)
                if key.strip() != "DATABASE_URL":
                    continue
                return value.strip().strip('"').strip("'")
        except Exception:
            return None
        return None

    db_url = os.getenv("DATABASE_URL") or load_db_url_from_env_file()
    if not db_url:
        print("ERROR: DATABASE_URL no esta configurada.")
        print("Ejemplo PowerShell:")
        print('  $env:DATABASE_URL="postgresql+psycopg://user:pass@host:5432/db"')
        print("O define DATABASE_URL en backend/.env.")
        return

    engine = create_engine(db_url)

    with engine.connect() as conn:
        print_section(f"OC {args.order_id} - detalles")
        rows = conn.execute(
            text(
                """
                select id, order_id, cantidad, deleted_at
                from po_order_details
                where order_id = :order_id
                order by id
                """
            ),
            {"order_id": args.order_id},
        ).fetchall()
        print_rows(rows)

        print_section(f"Factura {args.invoice_id} - detalles")
        rows = conn.execute(
            text(
                """
                select id, invoice_id, "poOrderDetail_id", cantidad, deleted_at
                from po_invoice_detalles
                where invoice_id = :invoice_id
                order by id
                """
            ),
            {"invoice_id": args.invoice_id},
        ).fetchall()
        print_rows(rows)

        print_section("Detalles de factura que referencian lineas de la OC")
        rows = conn.execute(
            text(
                """
                select d.id, d.invoice_id, d."poOrderDetail_id", d.cantidad, d.deleted_at
                from po_invoice_detalles d
                where d."poOrderDetail_id" in (
                    select id from po_order_details where order_id = :order_id
                )
                order by d.invoice_id, d.id
                """
            ),
            {"order_id": args.order_id},
        ).fetchall()
        print_rows(rows)

        print_section(f"Estado actual de la OC {args.order_id}")
        rows = conn.execute(
            text(
                """
                select o.id, s.nombre, s.orden
                from po_orders o
                join po_order_status s on s.id = o.order_status_id
                where o.id = :order_id
                """
            ),
            {"order_id": args.order_id},
        ).fetchall()
        print_rows(rows)

        print_section("Resumen de facturacion por linea (excluye deleted_at)")
        rows = conn.execute(
            text(
                """
                with fact_sub as (
                    select
                        d."poOrderDetail_id" as detail_id,
                        coalesce(sum(d.cantidad), 0) as facturada
                    from po_invoice_detalles d
                    join po_invoices i on i.id = d.invoice_id
                    where d.deleted_at is null
                      and i.deleted_at is null
                    group by d."poOrderDetail_id"
                )
                select
                    pod.id as detail_id,
                    pod.cantidad as cantidad_oc,
                    coalesce(fact_sub.facturada, 0) as cantidad_facturada,
                    case when coalesce(fact_sub.facturada, 0) > 0 then 1 else 0 end as tiene_factura,
                    case when coalesce(fact_sub.facturada, 0) >= pod.cantidad then 1 else 0 end as linea_completa
                from po_order_details pod
                left join fact_sub on fact_sub.detail_id = pod.id
                where pod.order_id = :order_id
                  and pod.deleted_at is null
                order by pod.id
                """
            ),
            {"order_id": args.order_id},
        ).fetchall()
        print_rows(rows)

        print_section("Resumen agregado por OC (para status)")
        rows = conn.execute(
            text(
                """
                with fact_sub as (
                    select
                        d."poOrderDetail_id" as detail_id,
                        coalesce(sum(d.cantidad), 0) as facturada
                    from po_invoice_detalles d
                    join po_invoices i on i.id = d.invoice_id
                    where d.deleted_at is null
                      and i.deleted_at is null
                    group by d."poOrderDetail_id"
                )
                select
                    pod.order_id,
                    count(*) as total_lines,
                    sum(case when coalesce(fact_sub.facturada, 0) > 0 then 1 else 0 end) as lines_facturada,
                    sum(case when coalesce(fact_sub.facturada, 0) >= pod.cantidad then 1 else 0 end) as lines_full
                from po_order_details pod
                left join fact_sub on fact_sub.detail_id = pod.id
                where pod.order_id = :order_id
                  and pod.deleted_at is null
                group by pod.order_id
                """
            ),
            {"order_id": args.order_id},
        ).fetchall()
        print_rows(rows)


if __name__ == "__main__":
    main()
