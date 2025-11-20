from __future__ import annotations

from datetime import date
from decimal import Decimal
from typing import Optional

from sqlmodel import Session, select

from app.models import CotizacionMoneda, Moneda


class CotizacionService:
    """Resolver conversiones de moneda usando la tabla de cotizaciones."""

    @staticmethod
    def obtener_moneda(session: Session, codigo: str) -> Optional[Moneda]:
        return session.exec(select(Moneda).where(Moneda.codigo == codigo)).first()

    @staticmethod
    def obtener_cotizacion(
        session: Session,
        moneda_origen_id: int,
        moneda_destino_id: int,
        fecha: date,
    ) -> Optional[CotizacionMoneda]:
        return session.exec(
            select(CotizacionMoneda)
            .where(CotizacionMoneda.moneda_origen_id == moneda_origen_id)
            .where(CotizacionMoneda.moneda_destino_id == moneda_destino_id)
            .where(CotizacionMoneda.fecha_vigencia <= fecha)
            .order_by(CotizacionMoneda.fecha_vigencia.desc())
        ).first()

    @staticmethod
    def convertir(
        session: Session,
        monto: Decimal,
        moneda_origen_id: int,
        moneda_destino_id: int,
        fecha: date,
    ) -> Optional[Decimal]:
        if moneda_origen_id == moneda_destino_id:
            return monto
        cotizacion = CotizacionService.obtener_cotizacion(
            session, moneda_origen_id, moneda_destino_id, fecha
        )
        if not cotizacion:
            return None
        return (monto * cotizacion.tipo_cambio).quantize(Decimal("0.01"))


cotizacion_service = CotizacionService()
