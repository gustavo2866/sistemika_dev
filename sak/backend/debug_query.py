#!/usr/bin/env python3
"""
Test the exact query we're running
"""

import sys
sys.path.append('.')

from app.db import get_session  
from app.models import PoOrder, PoOrderStatus
from sqlalchemy import func, select

# Crear sesión
session = next(get_session())

print("🔍 TESTING EXACT BATCH QUERY")
print("=" * 50)

oportunidad_ids = [205]
EXECUTED_STATUS_KEYS = {"solicitada", "aprobada", "en_proceso", "emitida", "facturada", "pagada", "completada", "entregada"}

print(f"🎯 Oportunidades: {oportunidad_ids}")
print(f"✅ Estados válidos: {EXECUTED_STATUS_KEYS}")

# La query exacta que usa el código
stmt_batch = (
    select(PoOrder.oportunidad_id, func.sum(PoOrder.total))
    .select_from(PoOrder)  
    .join(PoOrderStatus, PoOrder.order_status_id == PoOrderStatus.id)
    .where(PoOrder.deleted_at.is_(None))
    .where(PoOrder.oportunidad_id.in_(oportunidad_ids))
    .where(func.lower(PoOrderStatus.nombre).in_(EXECUTED_STATUS_KEYS))
    .group_by(PoOrder.oportunidad_id)
)

print(f"📝 Query SQL: {stmt_batch}")

results = session.exec(stmt_batch).all()
print(f"🎉 Resultados: {results}")

# También probemos sin func.lower() por si acaso
stmt_batch_no_lower = (
    select(PoOrder.oportunidad_id, func.sum(PoOrder.total))
    .select_from(PoOrder)
    .join(PoOrderStatus, PoOrder.order_status_id == PoOrderStatus.id)
    .where(PoOrder.deleted_at.is_(None))
    .where(PoOrder.oportunidad_id.in_(oportunidad_ids))
    .where(PoOrderStatus.nombre.in_(EXECUTED_STATUS_KEYS))
    .group_by(PoOrder.oportunidad_id)
)

print(f"\n🔄 Probando SIN func.lower()...")
results_no_lower = session.exec(stmt_batch_no_lower).all()  
print(f"🎉 Resultados SIN lower: {results_no_lower}")

session.close()
print("\n✅ Test completado")