#!/usr/bin/env python3
"""
Debug script para verificar órdenes de compra
"""

import sys
sys.path.append('.')

from app.db import get_session
from app.models import PoOrder, PoOrderStatus
from sqlalchemy import func

# Crear sesión
session = next(get_session())

print("🔍 DEBUGGING ÓRDENES DE COMPRA")
print("=" * 50)

# Verificar oportunidad_id específica  
oportunidad_id = 205

print(f"📋 Buscando órdenes para oportunidad_id = {oportunidad_id}")

# Órdenes totales para esta oportunidad
total_orders = session.query(PoOrder).filter(
    PoOrder.oportunidad_id == oportunidad_id,
    PoOrder.deleted_at.is_(None)
).count()

print(f"📊 Total órdenes (no eliminadas): {total_orders}")

if total_orders > 0:
    # Ver estados de las órdenes
    order_states = session.query(
        PoOrderStatus.nombre,
        func.count(PoOrder.id),
        func.sum(PoOrder.total)
    ).join(
        PoOrder, PoOrder.order_status_id == PoOrderStatus.id
    ).filter(
        PoOrder.oportunidad_id == oportunidad_id,
        PoOrder.deleted_at.is_(None)
    ).group_by(PoOrderStatus.nombre).all()
    
    print(f"📈 Estados de órdenes:")
    for estado, count, total in order_states:
        print(f"   - {estado}: {count} órdenes, ${total:,.2f}")
    
    # Estados que consideramos "ejecutados"
    EXECUTED_STATUS_KEYS = {"emitida", "facturada", "pagada", "completada", "entregada"}
    
    executed_orders = session.query(
        func.sum(PoOrder.total)
    ).join(
        PoOrderStatus, PoOrder.order_status_id == PoOrderStatus.id
    ).filter(
        PoOrder.oportunidad_id == oportunidad_id,
        PoOrder.deleted_at.is_(None),
        func.lower(PoOrderStatus.nombre).in_(EXECUTED_STATUS_KEYS)
    ).scalar()
    
    print(f"💰 Total ejecutado (estados válidos): ${executed_orders or 0:,.2f}")
    
    # Ver todos los estados únicos para debug
    all_states = session.query(PoOrderStatus.nombre).join(
        PoOrder, PoOrder.order_status_id == PoOrderStatus.id
    ).filter(
        PoOrder.oportunidad_id == oportunidad_id,
        PoOrder.deleted_at.is_(None)
    ).distinct().all()
    
    print(f"🏷️  Estados únicos encontrados: {[s[0] for s in all_states]}")

else:
    print("❌ No hay órdenes para esta oportunidad")

# Verificar otras oportunidades con órdenes
print(f"\n🔍 Buscando otras oportunidades con órdenes...")
other_opportunities = session.query(
    PoOrder.oportunidad_id,
    func.count(PoOrder.id),
    func.sum(PoOrder.total)
).filter(
    PoOrder.deleted_at.is_(None),
    PoOrder.oportunidad_id.is_not(None)
).group_by(PoOrder.oportunidad_id).limit(10).all()

print(f"📊 Top 10 oportunidades con órdenes:")
for opp_id, count, total in other_opportunities:
    print(f"   - Oportunidad {opp_id}: {count} órdenes, ${total:,.2f}")

session.close()
print("\n✅ Debug completado")