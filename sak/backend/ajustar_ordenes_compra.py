#!/usr/bin/env python3
"""
Script para ajustar valores de órdenes de compra basándose en presupuestos MO-propia
Genera variaciones más realistas: algunas por encima, otras por debajo
"""

import sys
import random
from datetime import date
from decimal import Decimal

sys.path.insert(0, '.')
from sqlmodel import Session, select
from app.db import get_session
from app.models.compras import PoOrder, PoOrderDetail
from app.models.proy_presupuesto import ProyPresupuesto

def ajustar_ordenes_compra():
    print('=== AJUSTE DE VALORES ORDENES DE COMPRA ===')
    print('Basándose en presupuestos MO-propia con variaciones realistas')
    print()
    
    try:
        session = next(get_session())
        
        # Mapeo de fechas entre órdenes y presupuestos
        fechas_mapeo = {
            '2025-12': date(2025, 12, 31),
            '2026-01': date(2026, 1, 31), 
            '2026-02': date(2026, 2, 28),
            '2026-03': date(2026, 3, 31),
        }
        
        # Obtener órdenes de compra existentes
        ordenes = session.exec(
            select(PoOrder)
            .where(PoOrder.titulo.contains('MO-Propios Proyecto'))
            .order_by(PoOrder.id)
        ).all()
        
        # Obtener presupuestos correspondientes
        presupuestos = session.exec(
            select(ProyPresupuesto)
            .where(ProyPresupuesto.proyecto_id.in_([14, 15, 16, 17]))
            .where(ProyPresupuesto.deleted_at.is_(None))
        ).all()
        
        print(f'Órdenes encontradas: {len(ordenes)}')
        print(f'Presupuestos encontrados: {len(presupuestos)}')
        print()
        
        ordenes_ajustadas = 0
        
        # Predefinir algunas variaciones para tener un mix balanceado
        variaciones = [
            -15, -10, -18, +5,    # Proyecto 14: más por debajo
            +8, -12, +15, -5,     # Proyecto 15: mix equilibrado  
            -8, +12, -15, +10,    # Proyecto 16: mix equilibrado
            +6, -20, +3, -7       # Proyecto 17: mix con una baja
        ]
        
        print("Ord | Proy | Período  | Presupuesto | Variación | Nuevo Total | Cambio")
        print("-" * 75)
        
        for idx, orden in enumerate(ordenes):
            # Extraer datos de la orden
            if 'Proyecto ' in orden.titulo:
                proyecto_str = orden.titulo.split('Proyecto ')[1].split(' -')[0]
                proyecto_id = int(proyecto_str)
                
                # Extraer período
                periodo = None
                for per in ['2025-12', '2026-01', '2026-02', '2026-03']:
                    if per in orden.titulo:
                        periodo = per
                        break
                
                if periodo:
                    fecha_presupuesto = fechas_mapeo[periodo]
                    
                    # Buscar presupuesto correspondiente
                    presupuesto = next((p for p in presupuestos 
                                      if p.proyecto_id == proyecto_id 
                                      and p.fecha == fecha_presupuesto), None)
                    
                    if presupuesto:
                        # Calcular nuevo valor basado en presupuesto + variación
                        variacion_pct = variaciones[idx] if idx < len(variaciones) else random.uniform(-15, 10)
                        valor_base = float(presupuesto.mo_propia)
                        factor_variacion = 1 + (variacion_pct / 100)
                        nuevo_total = valor_base * factor_variacion
                        
                        # Actualizar orden
                        valor_anterior = float(orden.total)
                        orden.total = Decimal(f"{nuevo_total:.2f}")
                        
                        # Actualizar detalle correspondiente (precio por hora)
                        detalle = session.exec(
                            select(PoOrderDetail)
                            .where(PoOrderDetail.order_id == orden.id)
                        ).first()
                        
                        if detalle:
                            # Mantener 1000 horas, ajustar precio unitario
                            detalle.precio = Decimal(f"{nuevo_total/1000:.2f}")
                        
                        cambio_total = nuevo_total - valor_anterior
                        cambio_pct = (cambio_total / valor_anterior) * 100 if valor_anterior > 0 else 0
                        
                        print(f"{orden.id:3d} | P{proyecto_id:2d}  | {periodo:8s} | ${valor_base/1000000:9.2f}M | {variacion_pct:+5.1f}% | ${nuevo_total/1000000:9.2f}M | {cambio_pct:+6.1f}%")
                        
                        ordenes_ajustadas += 1
        
        if ordenes_ajustadas > 0:
            session.commit()
            print(f'\\n✅ {ordenes_ajustadas} órdenes ajustadas exitosamente')
            print(f'   - Valores basados en presupuestos MO-propia')
            print(f'   - Variaciones entre -20% y +15%')
            print(f'   - Mix balanceado: unas por encima, otras por debajo')
        else:
            print('\\n⚠️  No se ajustaron órdenes')
            
    except Exception as e:
        print(f'❌ Error: {e}')
        import traceback
        traceback.print_exc()
        if 'session' in locals():
            session.rollback()
    finally:
        if 'session' in locals():
            session.close()

if __name__ == '__main__':
    ajustar_ordenes_compra()