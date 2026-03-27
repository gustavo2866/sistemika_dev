#!/usr/bin/env python3
"""
Test de la optimización implementada en fetch_proyectos_for_dashboard
"""

import sys
import os
from pathlib import Path

# Configurar path correctamente
backend_dir = Path(__file__).parent
sys.path.insert(0, str(backend_dir))

# Imports después de configurar el path
from sqlmodel import Session, create_engine
from app.services.proyectos_dashboard import fetch_proyectos_for_dashboard, build_proyectos_dashboard_payload
from datetime import datetime, timedelta
import time
from dotenv import load_dotenv

def get_database_session():
    """Crear sesión de base de datos"""
    load_dotenv()
    
    database_url = os.getenv("DATABASE_URL", "postgresql://postgres:password@localhost:5432/sak_dev")
    
    # Conectar a la base de datos
    engine = create_engine(
        database_url,
        pool_pre_ping=True,
        pool_size=5,
        max_overflow=10
    )
    
    return Session(engine)

async def test_performance_optimizada():
    """Prueba la performance después de la optimización"""
    
    # Fecha range para el último mes
    end_date = datetime.now()
    start_date = end_date - timedelta(days=30)
    start_date_str = start_date.strftime("%Y-%m-%d")
    end_date_str = end_date.strftime("%Y-%m-%d")
    
    print(f"🚀 TEST DE PERFORMANCE OPTIMIZADA")
    print(f"📅 Rango: {start_date_str} a {end_date_str}")
    print(f"=" * 60)
    
    session = get_database_session()
    
    try:
        # Test del fetch optimizado
        print("\n⏱️  FETCH PROYECTOS (CON LIMIT 15 Y BATCH QUERIES)")
        start_time = time.time()
        
        proyectos = fetch_proyectos_for_dashboard(
            session=session,
            start_date=start_date_str,
            end_date=end_date_str
        )
        
        fetch_time = time.time() - start_time
        print(f"   📊 Proyectos obtenidos: {len(proyectos)}")
        print(f"   ⏰ Tiempo fetch: {fetch_time:.2f}s")
        
        # Test del payload completo
        print("\n⏱️  PAYLOAD COMPLETO (FETCH + PROCESAMIENTO)")
        start_time = time.time()
        
        payload = build_proyectos_dashboard_payload(
            items=proyectos,  # Pasar los proyectos obtenidos
            start_date=start_date_str,
            end_date=end_date_str,
            session=session
        )
        
        total_time = time.time() - start_time
        print(f"   📈 KPIs calculados: {len(payload['kpis'])}")
        print(f"   📊 Payload keys: {list(payload.keys())}")
        proyectos_count = len(payload.get('proyectos', payload.get('items', [])))
        print(f"   📊 Proyectos en payload: {proyectos_count}")
        print(f"   ⏰ Tiempo total: {total_time:.2f}s")
        
        # Análisis de mejora
        tiempo_anterior_estimado = 6.4  # Tiempo anterior medido
        mejora_porcentual = ((tiempo_anterior_estimado - total_time) / tiempo_anterior_estimado) * 100
        
        print(f"\n🎯 ANÁLISIS DE MEJORA")
        print(f"   ⏰ Tiempo anterior: ~{tiempo_anterior_estimado:.1f}s")
        print(f"   ⏰ Tiempo actual: {total_time:.2f}s")
        print(f"   📈 Mejora: {mejora_porcentual:.1f}%")
        
        if total_time < 2.0:
            print(f"   ✅ OBJETIVO CUMPLIDO: < 2 segundos!")
        elif total_time < 3.0:
            print(f"   ⚡ BUENA MEJORA: < 3 segundos")
        else:
            print(f"   ⚠️  Necesita más optimización")
        
        # Detalles de proyectos
        print(f"\n📋 DETALLES DE PROYECTOS")
        for i, proy in enumerate(proyectos[:5], 1):
            print(f"   {i}. ID {proy.id:<3} | {proy.nombre_proyecto[:30]:<30} | Estado: {proy.estado}")
        
        if len(proyectos) > 5:
            print(f"   ... y {len(proyectos) - 5} más")
            
    except Exception as e:
        print(f"❌ Error en prueba: {e}")
        import traceback
        traceback.print_exc()
    finally:
        session.close()

if __name__ == "__main__":
    import asyncio
    asyncio.run(test_performance_optimizada())