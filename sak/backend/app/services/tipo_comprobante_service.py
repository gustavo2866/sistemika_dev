from __future__ import annotations

import unicodedata
from typing import Optional

from sqlmodel import Session, select

from app.models.tipo_comprobante import (
    DEFAULT_TIPO_COMPROBANTE_NAMES,
    TipoComprobante,
)

_ALIAS_MAP = {
    'FACTURA A': 'Factura A',
    'FACTURAA': 'Factura A',
    'FACTURA B': 'Factura B',
    'FACTURAB': 'Factura B',
    'FACTURA C': 'Factura C',
    'FACTURAC': 'Factura C',
    'FACTURA M': 'Factura M',
    'FACTURAM': 'Factura M',
    'A': 'Factura A',
    'B': 'Factura B',
    'C': 'Factura C',
    'M': 'Factura M',
    'NC': 'NC A',
    'NC A': 'NC A',
    'NCA': 'NC A',
    'NOTA DE CREDITO A': 'NC A',
    'NOTACREDITOA': 'NC A',
    'NC B': 'NC B',
    'NCB': 'NC B',
    'NOTA DE CREDITO B': 'NC B',
    'NOTACREDITOB': 'NC B',
    'NC C': 'NC C',
    'NCC': 'NC C',
    'NOTA DE CREDITO C': 'NC C',
    'NOTACREDITOC': 'NC C',
}


def _normalize_key(raw: str | None) -> Optional[str]:
    if raw is None:
        return None
    value = str(raw).strip()
    if not value:
        return None
    value = unicodedata.normalize('NFKD', value)
    value = ''.join(ch for ch in value if not unicodedata.combining(ch))
    return value.upper().strip()


def normalize_tipo_comprobante(raw: str | None) -> Optional[str]:
    key = _normalize_key(raw)
    if not key:
        return None
    if key in _ALIAS_MAP:
        return _ALIAS_MAP[key]
    if key.startswith('FACTURA '):
        suffix = key.split('FACTURA ', 1)[1].strip()
        candidate = _ALIAS_MAP.get(f'FACTURA {suffix}') or _ALIAS_MAP.get(suffix)
        if candidate:
            return candidate
    if key.startswith('NOTA DE CREDITO '):
        suffix = key.split('NOTA DE CREDITO ', 1)[1].strip()
        candidate = _ALIAS_MAP.get(f'NC {suffix}')
        if candidate:
            return candidate
    return key.title()


def get_or_create_tipo_comprobante(session: Session, name: str) -> TipoComprobante:
    statement = select(TipoComprobante).where(TipoComprobante.name == name)
    existing = session.exec(statement).first()
    if existing:
        return existing
    tipo = TipoComprobante(name=name)
    session.add(tipo)
    session.commit()
    session.refresh(tipo)
    return tipo


def resolve_tipo_comprobante(
    session: Session,
    raw_value: str | None,
    default_name: str | None = None,
) -> Optional[TipoComprobante]:
    canonical = normalize_tipo_comprobante(raw_value)
    if not canonical and default_name:
        canonical = normalize_tipo_comprobante(default_name)
    if not canonical:
        return None
    return get_or_create_tipo_comprobante(session, canonical)


def seed_default_tipos(session: Session) -> None:
    for name in DEFAULT_TIPO_COMPROBANTE_NAMES:
        get_or_create_tipo_comprobante(session, name)
