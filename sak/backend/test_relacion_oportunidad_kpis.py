#!/usr/bin/env python3
"""
Test para verificar el cálculo corregido de KPIs Real - Dashboard Proyectos
Verifica la relación po_orders por oportunidad_id (no centro_costo).
"""

import sys
from datetime import date
from decimal import Decimal

# Agregar el directorio backend al path para importar módulos
sys.path.append(".")

from sqlmodel import Session, select
from app.db import engine
from app.models.proyecto import Proyecto
from app.models.po_order import PoOrder
from app.services.proyectos_dashboard import (
    _get_periods_by_type,
    _calculate_presupuestado_kpis,
    _calculate_real_kpis,
    _calculate_presupuesto_total_kpis,
    _calculate_real_total_kpis,
    TIPO_COSTO_MAP
)


def test_relacion_oportunidad_id():
    """Test de la nueva relación proyecto->oportunidad->po_orders"""
    print("=== TEST RELACIÓN OPORTUNIDAD_ID ===")
    
    with Session(engine) as session:
        # 1. Buscar proyectos con oportunidad_id
        stmt_proyectos = select(Proyecto).where(
            Proyecto.oportunidad_id.is_not(None)
        ).limit(5)
        proyectos = session.exec(stmt_proyectos).all()
        
        print(f"Proyectos con oportunidad_id: {len(proyectos)}")
        for p in proyectos:
            print(f"  - Proyecto {p.id}: oportunidad_id={p.oportunidad_id}")
        
        if not proyectos:
            print("❌ No hay proyectos con oportunidad_id para testear")
            return
        
        # 2. Verificar po_orders con esas oportunidades
        oportunidades_ids = [p.oportunidad_id for p in proyectos]
        stmt_po_orders = select(PoOrder).where(
            PoOrder.oportunidades_id.in_(oportunidades_ids)
        ).limit(10)
        po_orders = session.exec(stmt_po_orders).all()
        
        print(f"\nPO Orders relacionadas: {len(po_orders)}")
        for po in po_orders:
            print(f"  - PO {po.id}: oportunidad_id={po.oportunidades_id}, tipo_solicitud_id={po.tipo_solicitud_id}, total=${po.total}")
        
        # 3. Mostrar clasificación de tipos
        print(f"\nClasificación de tipos de costo:")
        for tipo_costo, tipo_solicitud_ids in TIPO_COSTO_MAP.items():
            print(f"  - {tipo_costo}: {tipo_solicitud_ids}")
            
        # 4. Test KPIs con nueva relación
        proyectos_ids = [p.id for p in proyectos]
        end_date = date(2024, 12, 31)
        periods = _get_periods_by_type(end_date, "mensual")
        
        print(f"\n--- KPIs CON RELACIÓN POR OPORTUNIDAD_ID ---")
        
        # KPIs Real con nueva lógica
        kpis_real = _calculate_real_kpis(session, proyectos_ids, periods, "mensual")
        print(f"Real KPIs:")
        print(f"  - Materiales: ${kpis_real['materiales']:,.2f}")
        print(f"  - MO Propia: ${kpis_real['mo_propia']:,.2f}")  
        print(f"  - MO Terceros: ${kpis_real['mo_terceros']:,.2f}")
        print(f"  - Importe: ${kpis_real['importe']:,.2f}")
        
        # KPIs Real Total
        kpis_real_total = _calculate_real_total_kpis(session, proyectos_ids, end_date)
        print(f"\nReal Total KPIs:")
        print(f"  - Materiales: ${kpis_real_total['materiales']:,.2f}")
        print(f"  - MO Propia: ${kpis_real_total['mo_propia']:,.2f}")
        print(f"  - MO Terceros: ${kpis_real_total['mo_terceros']:,.2f}")
        print(f"  - Importe: ${kpis_real_total['importe']:,.2f}")


def test_kpis_completos_corregidos():
    """Test completo de KPIs con la relación corregida"""
    print("\n=== TEST KPIs COMPLETOS - RELACIÓN CORREGIDA ===")
    
    with Session(engine) as session:
        # Obtener proyectos con oportunidad_id para hacer el test significativo
        stmt = select(Proyecto).where(
            Proyecto.oportunidad_id.is_not(None),
            Proyecto.estado.in_(["EN_PROCESO", "ACTIVO", "PLANIFICACION"])
        ).limit(10)
        proyectos = session.exec(stmt).all()
        
        if not proyectos:
            print("❌ No hay proyectos activos con oportunidad_id")
            return
            
        proyectos_ids = [p.id for p in proyectos]
        end_date = date(2024, 12, 31)
        periods = _get_periods_by_type(end_date, "mensual")
        
        print(f"Procesando {len(proyectos)} proyectos...")
        
        # 1. Presupuestado (desde proy_presupuesto)
        kpis_presup = _calculate_presupuestado_kpis(session, proyectos_ids, periods, "mensual")
        print(f"\n1. KPIs PRESUPUESTADOS (últimos 4 meses):")
        print(f"   Importe: ${kpis_presup['importe']:,.0f}")
        print(f"   Materiales: ${kpis_presup['materiales']:,.0f}")
        print(f"   MO Propia: ${kpis_presup['mo_propia']:,.0f}")
        print(f"   MO Terceros: ${kpis_presup['mo_terceros']:,.0f}")
        
        # 2. Real (proyecto_avance + po_orders por oportunidad_id)
        kpis_real = _calculate_real_kpis(session, proyectos_ids, periods, "mensual")
        print(f"\n2. KPIs REAL (últimos 4 meses - RELACIÓN OPORTUNIDAD_ID):")
        print(f"   Importe: ${kpis_real['importe']:,.0f} (desde proyecto_avance)")
        print(f"   Materiales: ${kpis_real['materiales']:,.0f} (desde po_orders)")
        print(f"   MO Propia: ${kpis_real['mo_propia']:,.0f} (desde po_orders)")
        print(f"   MO Terceros: ${kpis_real['mo_terceros']:,.0f} (desde po_orders)")
        
        # 3. Total Presupuestado (TODOS los registros sin filtro de fecha)
        kpis_presup_total = _calculate_presupuesto_total_kpis(session, proyectos_ids)
        print(f"\n3. KPIs PRESUPUESTO TOTAL (acumulado - SIN FILTRO FECHA):")
        print(f"   Importe: ${kpis_presup_total['importe']:,.0f}")
        print(f"   Materiales: ${kpis_presup_total['materiales']:,.0f}")
        print(f"   MO Propia: ${kpis_presup_total['mo_propia']:,.0f}")
        print(f"   MO Terceros: ${kpis_presup_total['mo_terceros']:,.0f}")
        
        # 4. Real Total
        kpis_real_total = _calculate_real_total_kpis(session, proyectos_ids, end_date)
        print(f"\n4. KPIs REAL TOTAL (acumulado - RELACIÓN OPORTUNIDAD_ID):")
        print(f"   Importe: ${kpis_real_total['importe']:,.0f} (desde proyecto_avance)")
        print(f"   Materiales: ${kpis_real_total['materiales']:,.0f} (desde po_orders)")
        print(f"   MO Propia: ${kpis_real_total['mo_propia']:,.0f} (desde po_orders)")
        print(f"   MO Terceros: ${kpis_real_total['mo_terceros']:,.0f} (desde po_orders)")
        
        # Diagnóstico
        print(f"\n📊 DIAGNÓSTICO:")
        if kpis_real['materiales'] > 0 or kpis_real['mo_propia'] > 0 or kpis_real['mo_terceros'] > 0:
            print("✅ po_orders con relación oportunidad_id está funcionando")
        else:
            print("⚠️ po_orders sigue devolviendo $0 - verificar datos o relación")


if __name__ == "__main__":
    print("🔍 TEST: KPIs Dashboard Proyectos - RELACIÓN CORREGIDA por oportunidad_id")
    print("=" * 80)
    
    try:
        test_relacion_oportunidad_id()
        test_kpis_completos_corregidos()
        
        print("\n✅ Tests de relación oportunidad_id completados")
        
    except Exception as e:
        print(f"\n❌ Error en el test: {e}")
        import traceback
        traceback.print_exc()