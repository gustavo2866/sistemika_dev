#!/usr/bin/env python3
"""
Test para verificar el cálculo de KPIs del dashboard de proyectos
con diferentes tipos de períodos (mensual, trimestral, semestral, anual).
"""

import sys
from datetime import date
from decimal import Decimal

# Agregar el directorio backend al path para importar módulos
sys.path.append(".")

from sqlmodel import Session, select
from app.db import engine
from app.models.proyecto import Proyecto
from app.services.proyectos_dashboard import (
    _get_periods_by_type,
    _calculate_presupuestado_kpis,
    _calculate_real_kpis,
    _calculate_presupuesto_total_kpis,
    _calculate_real_total_kpis
)


def test_periods():
    """Test de generación de períodos por tipo"""
    print("=== TEST DE PERÍODOS ===")
    end_date = date(2024, 12, 15)  # 15 de diciembre de 2024
    
    # Test mensual
    periods_mensual = _get_periods_by_type(end_date, "mensual")
    print(f"Períodos mensuales ({len(periods_mensual)}):")
    for i, (start, end) in enumerate(periods_mensual):
        print(f"  {i+1}. {start} → {end}")
    
    # Test trimestral
    periods_trimestral = _get_periods_by_type(end_date, "trimestral")
    print(f"\nPeríodos trimestrales ({len(periods_trimestral)}):")
    for i, (start, end) in enumerate(periods_trimestral):
        print(f"  {i+1}. {start} → {end}")
    
    # Test semestral
    periods_semestral = _get_periods_by_type(end_date, "semestral")
    print(f"\nPeríodos semestrales ({len(periods_semestral)}):")
    for i, (start, end) in enumerate(periods_semestral):
        print(f"  {i+1}. {start} → {end}")
    
    # Test anual
    periods_anual = _get_periods_by_type(end_date, "anual")
    print(f"\nPeríodos anuales ({len(periods_anual)}):")
    for i, (start, end) in enumerate(periods_anual):
        print(f"  {i+1}. {start} → {end}")


def test_kpis_con_diferentes_periodos():
    """Test KPIs con diferentes tipos de período"""
    print("\n=== TEST KPIs CON DIFERENTES PERÍODOS ===")
    
    with Session(engine) as session:
        # Obtener algunos proyectos
        stmt = select(Proyecto).limit(3)
        proyectos = session.exec(stmt).all()
        proyectos_ids = [p.id for p in proyectos]
        
        print(f"Proyectos seleccionados: {proyectos_ids}")
        
        end_date = date(2024, 12, 15)
        
        # Test con diferentes tipos de período
        tipos_periodo = ["mensual", "trimestral", "semestral", "anual"]
        
        for tipo_periodo in tipos_periodo:
            print(f"\n--- KPIs {tipo_periodo.upper()} ---")
            periods = _get_periods_by_type(end_date, tipo_periodo)
            
            # KPIs Presupuestados
            kpis_presup = _calculate_presupuestado_kpis(session, proyectos_ids, periods, tipo_periodo)
            print(f"Presupuestado Importe: ${kpis_presup['importe']:,.0f}")
            print(f"Períodos detallados: {len(kpis_presup['por_periodo'])}")
            for periodo in kpis_presup["por_periodo"]:
                print(f"  - {periodo['periodo']}: ${periodo['importe']:,.0f}")
            
            # KPIs Real
            kpis_real = _calculate_real_kpis(session, proyectos_ids, periods, tipo_periodo)
            print(f"Real Importe: ${kpis_real['importe']:,.0f}")
            
            # KPIs Totales
            kpis_presup_total = _calculate_presupuesto_total_kpis(session, proyectos_ids, end_date)
            kpis_real_total = _calculate_real_total_kpis(session, proyectos_ids, end_date)
            print(f"Presupuesto Total: ${kpis_presup_total['importe']:,.0f}")
            print(f"Real Total: ${kpis_real_total['importe']:,.0f}")


if __name__ == "__main__":
    print("🔍 TEST: KPIs Dashboard Proyectos - Diferentes Períodos")
    print("=" * 60)
    
    try:
        test_periods()
        test_kpis_con_diferentes_periodos()
        
        print("\n✅ Todos los tests de períodos completados exitosamente")
        
    except Exception as e:
        print(f"\n❌ Error en el test: {e}")
        import traceback
        traceback.print_exc()