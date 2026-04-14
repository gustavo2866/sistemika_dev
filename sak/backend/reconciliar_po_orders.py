#!/usr/bin/env python3
"""
Reconcilia consistencia de ordenes de compra:

1. Si una orden tiene total > 0 y no tiene detalles, crea un detalle sintetico.
2. Si un detalle tiene importe inconsistente, lo recalcula como cantidad * precio.
3. Si el total de la orden no coincide con la suma de detalles, lo corrige.

Uso:
  python reconciliar_po_orders.py --dry-run
  python reconciliar_po_orders.py --apply
"""

from __future__ import annotations

import argparse
import sys
from dataclasses import dataclass
from decimal import Decimal, ROUND_HALF_UP

sys.path.insert(0, ".")

from sqlmodel import Session, select

from app.db import engine
from app.models.compras import PoOrder, PoOrderDetail


TWOPLACES = Decimal("0.01")


def q2(value: Decimal | int | float | str | None) -> Decimal:
    return Decimal(str(value or 0)).quantize(TWOPLACES, rounding=ROUND_HALF_UP)


def q3(value: Decimal | int | float | str | None) -> Decimal:
    return Decimal(str(value or 0)).quantize(Decimal("0.001"), rounding=ROUND_HALF_UP)


def build_synthetic_description(order: PoOrder) -> str:
    base = (order.titulo or "").strip()
    note = (order.comentario or "").strip()
    if note and note.lower() != base.lower():
        return f"{base}. {note}"[:500]
    return base[:500] or f"Detalle generado para orden #{order.id}"


@dataclass
class ReconcileStats:
    orders_scanned: int = 0
    details_created: int = 0
    detail_importes_fixed: int = 0
    order_totals_fixed: int = 0


def reconcile_orders(apply_changes: bool) -> ReconcileStats:
    stats = ReconcileStats()

    with Session(engine) as session:
        orders = session.exec(
            select(PoOrder)
            .where(PoOrder.deleted_at.is_(None))
            .order_by(PoOrder.id.asc())
        ).all()

        for order in orders:
            stats.orders_scanned += 1
            detalles = [
                d for d in (order.detalles or [])
                if getattr(d, "deleted_at", None) is None
            ]

            # Caso 1: total cargado pero sin ningun detalle
            if not detalles and q2(order.total) > Decimal("0.00"):
                synthetic_detail = PoOrderDetail(
                    order_id=order.id,
                    articulo_id=None,
                    descripcion=build_synthetic_description(order),
                    unidad_medida="unidad",
                    cantidad=q3(1),
                    precio=q2(order.total),
                    importe=q2(order.total),
                    centro_costo_id=order.centro_costo_id,
                    oportunidad_id=order.oportunidad_id,
                )
                session.add(synthetic_detail)
                detalles.append(synthetic_detail)
                stats.details_created += 1
                print(
                    f"[create-detail] order={order.id} total={q2(order.total)} "
                    f"desc={synthetic_detail.descripcion!r}"
                )

            # Caso 2: importe del detalle no coincide con cantidad * precio
            for detail in detalles:
                expected_importe = q2(q3(detail.cantidad) * q2(detail.precio))
                current_importe = q2(detail.importe)
                if current_importe != expected_importe:
                    print(
                        f"[fix-detail] order={order.id} detail={detail.id} "
                        f"importe={current_importe} -> {expected_importe}"
                    )
                    detail.importe = expected_importe
                    stats.detail_importes_fixed += 1

            # Caso 3: total de cabecera no coincide con suma de detalles
            detail_total = q2(sum(q2(detail.importe) for detail in detalles))
            current_total = q2(order.total)
            if current_total != detail_total:
                print(
                    f"[fix-order-total] order={order.id} total={current_total} -> {detail_total}"
                )
                order.total = detail_total
                stats.order_totals_fixed += 1

        if apply_changes:
            session.commit()
        else:
            session.rollback()

    return stats


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser()
    parser.add_argument(
        "--apply",
        action="store_true",
        help="Persiste cambios en la base de datos.",
    )
    parser.add_argument(
        "--dry-run",
        action="store_true",
        help="Solo informa cambios. Es el modo por defecto.",
    )
    return parser.parse_args()


def main() -> int:
    args = parse_args()
    apply_changes = bool(args.apply)

    stats = reconcile_orders(apply_changes=apply_changes)
    mode = "APPLY" if apply_changes else "DRY-RUN"
    print("\n=== RESUMEN ===")
    print(f"modo={mode}")
    print(f"orders_scanned={stats.orders_scanned}")
    print(f"details_created={stats.details_created}")
    print(f"detail_importes_fixed={stats.detail_importes_fixed}")
    print(f"order_totals_fixed={stats.order_totals_fixed}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
