#!/usr/bin/env python3
"""
Test exhaustivo de precisión de KPIs Dashboard Proyectos
Compara KPIs calculados vs detalle manual para períodos específicos 2025-12 a 2026-03
"""

import sys
from datetime import date, datetime
from decimal import Decimal

# Agregar el directorio backend al path para importar módulos
sys.path.append(".")

from sqlmodel import Session, select, func
from app.db import engine
from app.models.proyecto import Proyecto
from app.models.compras import PoOrder, PoOrderStatusLog
from app.models.proy_presupuesto import ProyPresupuesto
from app.models.proyecto_avance import ProyectoAvance
from app.models.views.kpis_proyectos import VwKpisProyectosPoOrders
from app.services.proyectos_dashboard import (
    _get_periods_by_type,
    _calculate_presupuestado_kpis,
    _calculate_real_kpis,
    _calculate_presupuesto_total_kpis,
    _calculate_real_total_kpis
)


def obtener_periodos_test():
    """Obtiene los períodos específicos para el test"""
    return [
        (date(2025, 12, 1), date(2025, 12, 31)),  # 2025-12
        (date(2026, 1, 1), date(2026, 1, 31)),    # 2026-01
        (date(2026, 2, 1), date(2026, 2, 28)),    # 2026-02
        (date(2026, 3, 1), date(2026, 3, 31)),    # 2026-03
    ]


def obtener_proyectos_con_datos():
    """Obtiene proyectos que tienen datos en el rango de fechas"""
    with Session(engine) as session:
        # Proyectos con órdenes en la vista optimizada
        stmt_proyectos_ordenes = select(VwKpisProyectosPoOrders.proyecto_id).distinct()
        proyectos_ordenes = session.exec(stmt_proyectos_ordenes).all()
        
        # Proyectos con presupuesto 
        stmt_proyectos_presup = select(ProyPresupuesto.proyecto_id).distinct()
        proyectos_presup = session.exec(stmt_proyectos_presup).all()
        
        # Proyectos con avances
        stmt_proyectos_avance = select(ProyectoAvance.proyecto_id).distinct()
        proyectos_avance = session.exec(stmt_proyectos_avance).all()
        
        # Unión de todos
        all_proyectos = set(proyectos_ordenes + proyectos_presup + proyectos_avance)
        
        print(f"📊 Proyectos encontrados:")
        print(f"   - Con órdenes: {len(proyectos_ordenes)}")
        print(f"   - Con presupuesto: {len(proyectos_presup)}")
        print(f"   - Con avances: {len(proyectos_avance)}")
        print(f"   - Total únicos: {len(all_proyectos)}")
        
        return list(all_proyectos)


def calcular_presupuestado_manual(session, proyectos_ids, period_start, period_end):
    """Calcula KPIs presupuestados manualmente consultando la tabla"""
    stmt = select(ProyPresupuesto).where(
        ProyPresupuesto.proyecto_id.in_(proyectos_ids),
        ProyPresupuesto.fecha >= period_start,
        ProyPresupuesto.fecha <= period_end
    )
    
    presupuestos = session.exec(stmt).all()
    
    result = {
        "registros": len(presupuestos),
        "importe": sum(p.importe for p in presupuestos),
        "materiales": sum(p.materiales for p in presupuestos),
        "mo_propia": sum(p.mo_propia for p in presupuestos),
        "mo_terceros": sum(p.mo_terceros for p in presupuestos),
        "horas": sum(p.horas for p in presupuestos),
        "metros": sum(p.metros for p in presupuestos),
        "detalle": [
            {
                "proyecto_id": p.proyecto_id,
                "fecha": p.fecha,
                "importe": float(p.importe),
                "materiales": float(p.materiales),
                "mo_propia": float(p.mo_propia),
                "mo_terceros": float(p.mo_terceros)
            } for p in presupuestos[:5]  # Solo primeros 5 para muestra
        ]
    }
    
    return result


def calcular_real_manual(session, proyectos_ids, period_start, period_end):
    """Calcula KPIs reales manualmente"""
    # 1. Avances de proyecto
    stmt_avances = select(ProyectoAvance).where(
        ProyectoAvance.proyecto_id.in_(proyectos_ids),
        ProyectoAvance.fecha_registracion >= period_start,
        ProyectoAvance.fecha_registracion <= period_end
    )
    avances = session.exec(stmt_avances).all()
    
    importe_avances = sum(a.importe for a in avances)
    horas_avances = sum(a.horas for a in avances)
    
    # 2. PO Orders usando vista optimizada
    stmt_po_orders = select(VwKpisProyectosPoOrders).where(
        VwKpisProyectosPoOrders.proyecto_id.in_(proyectos_ids),
        VwKpisProyectosPoOrders.fecha_emision >= period_start,
        VwKpisProyectosPoOrders.fecha_emision <= period_end
    )
    po_orders = session.exec(stmt_po_orders).all()
    
    materiales_po = sum(po.importe for po in po_orders if po.concepto_proyecto == 'materiales')
    mo_propia_po = sum(po.importe for po in po_orders if po.concepto_proyecto == 'mo_propia')
    mo_terceros_po = sum(po.importe for po in po_orders if po.concepto_proyecto == 'mo_terceros')
    
    result = {
        "avances_registros": len(avances),
        "po_orders_registros": len(po_orders),
        "importe": importe_avances,
        "horas": horas_avances,
        "materiales": materiales_po,
        "mo_propia": mo_propia_po,
        "mo_terceros": mo_terceros_po,
        "detalle_avances": [
            {
                "proyecto_id": a.proyecto_id,
                "fecha": a.fecha_registracion,
                "importe": float(a.importe),
                "horas": float(a.horas)
            } for a in avances[:5]
        ],
        "detalle_po_orders": [
            {
                "nro_orden": po.nro_orden,
                "proyecto_id": po.proyecto_id,
                "fecha_emision": po.fecha_emision,
                "concepto": po.concepto_proyecto,
                "importe": float(po.importe)
            } for po in po_orders[:5]
        ]
    }
    
    return result


def comparar_valores(calculado, manual, campo, label):
    """Compara un valor calculado vs manual"""
    val_calc = float(calculado)
    val_manual = float(manual)
    diferencia = abs(val_calc - val_manual)
    
    if diferencia < 0.01:  # Tolerancia centavos
        resultado = "✅"
    elif diferencia < 100:  # Tolerancia $100
        resultado = "⚠️"
    else:
        resultado = "❌"
    
    print(f"   {resultado} {label}:")
    print(f"      Calculado: ${val_calc:,.2f}")
    print(f"      Manual:    ${val_manual:,.2f}")
    if diferencia > 0.01:
        print(f"      Diferencia: ${diferencia:,.2f}")
    
    return diferencia < 100


def test_precision_kpis_por_periodo():
    """Test de precisión de KPIs por cada período"""
    print("=== TEST PRECISIÓN KPIs POR PERÍODO ===")
    
    with Session(engine) as session:
        proyectos_ids = obtener_proyectos_con_datos()
        if not proyectos_ids:
            print("❌ No hay proyectos con datos para testear")
            return
        
        proyectos_ids = proyectos_ids[:10]  # Limitar para performance
        print(f"\n🎯 Testing con {len(proyectos_ids)} proyectos: {proyectos_ids}")
        
        periodos = obtener_periodos_test()
        
        for i, (period_start, period_end) in enumerate(periodos):
            periodo_label = f"{period_start.strftime('%Y-%m')}"
            print(f"\n🗓️  PERÍODO {i+1}: {periodo_label} ({period_start} → {period_end})")
            
            # === PRESUPUESTADO ===
            print(f"\n   📊 KPIs PRESUPUESTADOS:")
            
            # Calculado con función
            kpis_presup_calc = _calculate_presupuestado_kpis(session, proyectos_ids, [
                (period_start, period_end)
            ], "mensual")
            
            # Manual
            presup_manual = calcular_presupuestado_manual(session, proyectos_ids, period_start, period_end)
            
            print(f"      Registros: {presup_manual['registros']}")
            
            # Comparación
            all_ok = True
            all_ok &= comparar_valores(kpis_presup_calc['importe'], presup_manual['importe'], 'importe', 'Importe')
            all_ok &= comparar_valores(kpis_presup_calc['materiales'], presup_manual['materiales'], 'materiales', 'Materiales')
            all_ok &= comparar_valores(kpis_presup_calc['mo_propia'], presup_manual['mo_propia'], 'mo_propia', 'MO Propia')
            all_ok &= comparar_valores(kpis_presup_calc['mo_terceros'], presup_manual['mo_terceros'], 'mo_terceros', 'MO Terceros')
            
            if presup_manual['detalle']:
                print(f"      📝 Muestra presupuesto:")
                for det in presup_manual['detalle'][:2]:
                    print(f"         P{det['proyecto_id']} ({det['fecha']}): ${det['importe']:,.0f}")
            
            # === REAL ===
            print(f"\n   📈 KPIs REAL:")
            
            # Calculado con función 
            kpis_real_calc = _calculate_real_kpis(session, proyectos_ids, [
                (period_start, period_end)
            ], "mensual")
            
            # Manual
            real_manual = calcular_real_manual(session, proyectos_ids, period_start, period_end)
            
            print(f"      Avances: {real_manual['avances_registros']}, PO Orders: {real_manual['po_orders_registros']}")
            
            # Comparación
            all_ok &= comparar_valores(kpis_real_calc['importe'], real_manual['importe'], 'importe', 'Importe')
            all_ok &= comparar_valores(kpis_real_calc['materiales'], real_manual['materiales'], 'materiales', 'Materiales')
            all_ok &= comparar_valores(kpis_real_calc['mo_propia'], real_manual['mo_propia'], 'mo_propia', 'MO Propia')
            all_ok &= comparar_valores(kpis_real_calc['mo_terceros'], real_manual['mo_terceros'], 'mo_terceros', 'MO Terceros')
            
            if real_manual['detalle_avances']:
                print(f"      📝 Muestra avances:")
                for det in real_manual['detalle_avances'][:2]:
                    print(f"         P{det['proyecto_id']} ({det['fecha']}): ${det['importe']:,.0f}")
            
            if real_manual['detalle_po_orders']:
                print(f"      📝 Muestra órdenes:")
                for det in real_manual['detalle_po_orders'][:2]:
                    print(f"         O{det['nro_orden']} ({det['fecha_emision']}): {det['concepto']} ${det['importe']:,.0f}")
            
            # Resultado del período
            if all_ok:
                print(f"      🎉 PERÍODO {periodo_label}: ✅ CORRECTO")
            else:
                print(f"      ⚠️ PERÍODO {periodo_label}: ❌ DISCREPANCIAS")


def test_precision_kpis_totales():
    """Test de precisión de KPIs totales"""
    print(f"\n=== TEST PRECISIÓN KPIs TOTALES ===")
    
    with Session(engine) as session:
        proyectos_ids = obtener_proyectos_con_datos()[:10]
        end_date = date(2026, 3, 31)
        
        print(f"🎯 Testing KPIs Totales hasta {end_date}")
        
        # === PRESUPUESTO TOTAL ===
        print(f"\n📊 PRESUPUESTO TOTAL:")
        
        # Calculado
        presup_total_calc = _calculate_presupuesto_total_kpis(session, proyectos_ids)
        
        # Manual (todos los registros sin filtro fecha)
        stmt_presup_total = select(ProyPresupuesto).where(
            ProyPresupuesto.proyecto_id.in_(proyectos_ids)
        )
        presup_todos = session.exec(stmt_presup_total).all()
        
        presup_total_manual = {
            "registros": len(presup_todos),
            "importe": sum(p.importe for p in presup_todos),
            "materiales": sum(p.materiales for p in presup_todos),
            "mo_propia": sum(p.mo_propia for p in presup_todos),
            "mo_terceros": sum(p.mo_terceros for p in presup_todos)
        }
        
        print(f"   Registros: {presup_total_manual['registros']}")
        
        # Comparación
        all_ok = True
        all_ok &= comparar_valores(presup_total_calc['importe'], presup_total_manual['importe'], 'importe', 'Importe')
        all_ok &= comparar_valores(presup_total_calc['materiales'], presup_total_manual['materiales'], 'materiales', 'Materiales')
        all_ok &= comparar_valores(presup_total_calc['mo_propia'], presup_total_manual['mo_propia'], 'mo_propia', 'MO Propia')
        all_ok &= comparar_valores(presup_total_calc['mo_terceros'], presup_total_manual['mo_terceros'], 'mo_terceros', 'MO Terceros')
        
        # === REAL TOTAL ===  
        print(f"\n📈 REAL TOTAL:")
        
        # Calculado
        real_total_calc = _calculate_real_total_kpis(session, proyectos_ids, end_date)
        
        # Manual
        # Avances hasta fecha límite
        stmt_avances_total = select(ProyectoAvance).where(
            ProyectoAvance.proyecto_id.in_(proyectos_ids),
            ProyectoAvance.fecha_registracion <= end_date
        )
        avances_todos = session.exec(stmt_avances_total).all()
        
        # PO Orders hasta fecha límite usando vista
        stmt_po_total = select(VwKpisProyectosPoOrders).where(
            VwKpisProyectosPoOrders.proyecto_id.in_(proyectos_ids),
            VwKpisProyectosPoOrders.fecha_emision <= end_date
        )
        po_orders_todas = session.exec(stmt_po_total).all()
        
        real_total_manual = {
            "avances_registros": len(avances_todos),
            "po_orders_registros": len(po_orders_todas),
            "importe": sum(a.importe for a in avances_todos),
            "horas": sum(a.horas for a in avances_todos),
            "materiales": sum(po.importe for po in po_orders_todas if po.concepto_proyecto == 'materiales'),
            "mo_propia": sum(po.importe for po in po_orders_todas if po.concepto_proyecto == 'mo_propia'),
            "mo_terceros": sum(po.importe for po in po_orders_todas if po.concepto_proyecto == 'mo_terceros'),
        }
        
        print(f"   Avances: {real_total_manual['avances_registros']}, PO Orders: {real_total_manual['po_orders_registros']}")
        
        # Comparación
        all_ok &= comparar_valores(real_total_calc['importe'], real_total_manual['importe'], 'importe', 'Importe')
        all_ok &= comparar_valores(real_total_calc['materiales'], real_total_manual['materiales'], 'materiales', 'Materiales')
        all_ok &= comparar_valores(real_total_calc['mo_propia'], real_total_manual['mo_propia'], 'mo_propia', 'MO Propia')
        all_ok &= comparar_valores(real_total_calc['mo_terceros'], real_total_manual['mo_terceros'], 'mo_terceros', 'MO Terceros')
        
        if all_ok:
            print(f"\n🎉 KPIs TOTALES: ✅ CORRECTOS")
        else:
            print(f"\n⚠️ KPIs TOTALES: ❌ DISCREPANCIAS")


def mostrar_resumen_datos():
    """Muestra un resumen de los datos disponibles"""
    print("=== RESUMEN DE DATOS DISPONIBLES ===")
    
    with Session(engine) as session:
        # Vista optimizada
        stmt_vista = select(VwKpisProyectosPoOrders)
        vista_registros = session.exec(stmt_vista).all()
        
        if vista_registros:
            fechas_vista = [r.fecha_emision for r in vista_registros]
            fecha_min = min(fechas_vista)
            fecha_max = max(fechas_vista)
            
            print(f"📊 Vista optimizada: {len(vista_registros)} órdenes")
            print(f"   Rango fechas: {fecha_min} → {fecha_max}")
            
            # Por concepto
            conceptos = {}
            for r in vista_registros:
                if r.concepto_proyecto not in conceptos:
                    conceptos[r.concepto_proyecto] = {'count': 0, 'total': Decimal('0')}
                conceptos[r.concepto_proyecto]['count'] += 1
                conceptos[r.concepto_proyecto]['total'] += r.importe
                
            for concepto, data in conceptos.items():
                print(f"   - {concepto}: {data['count']} órdenes, ${data['total']:,.0f}")
        
        # Presupuestos
        stmt_presup = select(ProyPresupuesto)
        presup_registros = session.exec(stmt_presup).all()
        
        if presup_registros:
            fechas_presup = [p.fecha for p in presup_registros]
            fecha_min = min(fechas_presup)
            fecha_max = max(fechas_presup)
            total_presup = sum(p.importe for p in presup_registros)
            
            print(f"\n💰 Presupuestos: {len(presup_registros)} registros")
            print(f"   Rango fechas: {fecha_min} → {fecha_max}")
            print(f"   Total: ${total_presup:,.0f}")
        
        # Avances
        stmt_avances = select(ProyectoAvance)
        avances_registros = session.exec(stmt_avances).all()
        
        if avances_registros:
            fechas_avances = [a.fecha_registracion for a in avances_registros]
            fecha_min = min(fechas_avances)
            fecha_max = max(fechas_avances)
            total_avances = sum(a.importe for a in avances_registros)
            
            print(f"\n📈 Avances: {len(avances_registros)} registros")
            print(f"   Rango fechas: {fecha_min} → {fecha_max}")
            print(f"   Total: ${total_avances:,.0f}")


if __name__ == "__main__":
    print("🔍 TEST: Precisión KPIs Dashboard Proyectos - Períodos 2025-12 a 2026-03")
    print("=" * 80)
    
    try:
        # Mostrar datos disponibles
        mostrar_resumen_datos()
        
        # Test de precisión por período
        test_precision_kpis_por_periodo()
        
        # Test de precisión totales
        test_precision_kpis_totales()
        
        print("\n✅ Tests de precisión completados")
        
    except Exception as e:
        print(f"\n❌ Error en el test: {e}")
        import traceback
        traceback.print_exc()