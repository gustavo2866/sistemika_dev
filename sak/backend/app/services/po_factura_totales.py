from __future__ import annotations

from decimal import Decimal, ROUND_HALF_UP
from typing import Dict, Optional, Tuple

from sqlalchemy import func
from sqlmodel import Session, select

from app.models.articulo import Articulo
from app.models.compras import PoFactura, PoFacturaDetalle, PoFacturaTotal
from app.models.tipo_articulo import TipoArticulo


def _round_amount(value: Decimal | None) -> Decimal:
    if value is None:
        return Decimal("0.00")
    return value.quantize(Decimal("0.01"), rounding=ROUND_HALF_UP)


def _build_subtotales(
    session: Session,
    factura_id: int,
) -> Dict[Tuple[int, Optional[int]], Decimal]:
    subtotal_expr = (
        PoFacturaDetalle.subtotal - func.coalesce(PoFacturaDetalle.importe_descuento, 0)
    )
    stmt = (
        select(
            TipoArticulo.adm_concepto_id.label("concepto_id"),
            PoFacturaDetalle.centro_costo_id.label("centro_costo_id"),
            func.coalesce(func.sum(subtotal_expr), 0).label("importe"),
        )
        .select_from(PoFacturaDetalle)
        .join(Articulo, Articulo.id == PoFacturaDetalle.articulo_id)
        .join(TipoArticulo, TipoArticulo.id == Articulo.tipo_articulo_id)
        .where(PoFacturaDetalle.factura_id == factura_id)
        .group_by(TipoArticulo.adm_concepto_id, PoFacturaDetalle.centro_costo_id)
    )
    rows = session.exec(stmt).all()
    subtotales: Dict[Tuple[int, Optional[int]], Decimal] = {}
    for concepto_id, centro_costo_id, importe in rows:
        if concepto_id is None:
            continue
        subtotales[(concepto_id, centro_costo_id)] = _round_amount(importe)
    return subtotales


def _sync_subtotal_totales(
    session: Session,
    factura_id: int,
    subtotales: Dict[Tuple[int, Optional[int]], Decimal],
) -> Decimal:
    stmt = select(PoFacturaTotal).where(
        PoFacturaTotal.factura_id == factura_id,
        PoFacturaTotal.tipo == "subtotal",
    )
    existing = session.exec(stmt).all()
    existing_by_key = {
        (item.concepto_id, item.centro_costo_id): item for item in existing
    }

    for key, importe in subtotales.items():
        concepto_id, centro_costo_id = key
        current = existing_by_key.get(key)
        if current:
            current.importe = importe
        else:
            session.add(
                PoFacturaTotal(
                    factura_id=factura_id,
                    concepto_id=concepto_id,
                    centro_costo_id=centro_costo_id,
                    tipo="subtotal",
                    importe=importe,
                )
            )

    for key, item in existing_by_key.items():
        if key not in subtotales:
            session.delete(item)

    subtotal_total = sum(subtotales.values(), Decimal("0.00"))
    return _round_amount(subtotal_total)


def _get_impuestos_total(session: Session, factura_id: int) -> Decimal:
    stmt = select(func.coalesce(func.sum(PoFacturaTotal.importe), 0)).where(
        PoFacturaTotal.factura_id == factura_id,
        PoFacturaTotal.tipo == "impuesto",
    )
    impuestos_total = session.exec(stmt).one()
    return _round_amount(impuestos_total)


def recalculate_po_factura_totales(session: Session, factura_id: int) -> None:
    factura = session.get(PoFactura, factura_id)
    if not factura:
        return

    subtotales = _build_subtotales(session, factura_id)
    subtotal_total = _sync_subtotal_totales(session, factura_id, subtotales)
    impuestos_total = _get_impuestos_total(session, factura_id)

    factura.subtotal = subtotal_total
    factura.total_impuestos = impuestos_total
    factura.total = _round_amount(subtotal_total + impuestos_total)

    session.add(factura)
    session.commit()
    session.refresh(factura)
