from typing import Any, Dict, List
from sqlmodel import Session, select
from sqlalchemy import delete
from app.core.generic_crud import GenericCRUD
from app.models.factura import Factura
from app.models.factura_detalle import FacturaDetalle
from app.models.factura_impuesto import FacturaImpuesto
from decimal import Decimal

class FacturaCRUD(GenericCRUD[Factura]):
    """CRUD especializado para Factura con sincronización de detalles e impuestos."""

    def _to_decimal(self, v: Any) -> Decimal | None:
        if v is None:
            return None
        if isinstance(v, (int, float, Decimal)):
            return Decimal(str(v))
        if isinstance(v, str):
            try:
                return Decimal(v.replace(' ', '').replace(',', '.'))
            except Exception:
                return None
        return None

    def _coerce_detalle(self, d: Dict[str, Any], factura_id: int) -> Dict[str, Any]:
        return {
            'factura_id': factura_id,
            'codigo_producto': d.get('codigo_producto') or None,
            'descripcion': d.get('descripcion') or '',
            'cantidad': self._to_decimal(d.get('cantidad')) or Decimal('0'),
            'unidad_medida': d.get('unidad_medida') or None,
            'precio_unitario': self._to_decimal(d.get('precio_unitario')) or Decimal('0'),
            'subtotal': self._to_decimal(d.get('subtotal')) or Decimal('0'),
            'porcentaje_descuento': self._to_decimal(d.get('porcentaje_descuento')) or None,
            'importe_descuento': self._to_decimal(d.get('importe_descuento')) or None,
            'porcentaje_iva': self._to_decimal(d.get('porcentaje_iva')) or Decimal('0'),
            'importe_iva': self._to_decimal(d.get('importe_iva')) or Decimal('0'),
            'total_linea': self._to_decimal(d.get('total_linea')) or Decimal('0'),
            'orden': int(d.get('orden') or 0) or 0,
        }

    def _coerce_impuesto(self, imp: Dict[str, Any], factura_id: int) -> Dict[str, Any]:
        return {
            'factura_id': factura_id,
            'tipo_impuesto': (imp.get('tipo_impuesto') or 'IVA')[:50],
            'descripcion': (imp.get('descripcion') or 'Impuesto')[:255],
            'base_imponible': self._to_decimal(imp.get('base_imponible')) or Decimal('0'),
            'porcentaje': self._to_decimal(imp.get('porcentaje')) or Decimal('0'),
            'importe': self._to_decimal(imp.get('importe')) or Decimal('0'),
            'es_retencion': bool(imp.get('es_retencion') or False),
            'es_percepcion': bool(imp.get('es_percepcion') or False),
            'codigo_afip': imp.get('codigo_afip') or None,
            'numero_certificado': imp.get('numero_certificado') or None,
        }

    def _sync_children(self, session: Session, factura: Factura, data: Dict[str, Any]) -> None:
        detalles = data.get('detalles')
        if isinstance(detalles, list):
            # eliminar existentes (SQLAlchemy 2.0 style)
            session.exec(
                delete(FacturaDetalle).where(FacturaDetalle.factura_id == factura.id)
            )
            for d in detalles:
                if not isinstance(d, dict):
                    continue
                payload = self._coerce_detalle(d, factura.id)
                obj = FacturaDetalle(**payload)
                session.add(obj)

        impuestos = data.get('impuestos')
        if isinstance(impuestos, list):
            session.exec(
                delete(FacturaImpuesto).where(FacturaImpuesto.factura_id == factura.id)
            )
            for imp in impuestos:
                if not isinstance(imp, dict):
                    continue
                payload = self._coerce_impuesto(imp, factura.id)
                obj = FacturaImpuesto(**payload)
                session.add(obj)

        session.commit()

    def _process_relations(self, session: Session, obj: Factura, original_data: Dict[str, Any]) -> None:
        # Sincronizar listas hijas si se enviaron
        self._sync_children(session, obj, original_data)
