#!/usr/bin/env python3
"""
Test después de eliminar los conteos innecesarios
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

async def test_sin_conteos_innecesarios():
    """Prueba la performance después de eliminar conteos innecesarios"""
    
    # Fecha range para el último mes
    end_date = datetime.now()
    start_date = end_date - timedelta(days=30)
    start_date_str = start_date.strftime("%Y-%m-%d")
    end_date_str = end_date.strftime("%Y-%m-%d")
    
    print(f"🚀 TEST SIN CONTEOS INNECESARIOS")
    print(f"📅 Rango: {start_date_str} a {end_date_str}")
    print(f"=" * 60)
    
    session = get_database_session()
    
    try:
        # Test del fetch 
        print("\n⏱️  FETCH PROYECTOS")
        start_time = time.time()
        
        proyectos = fetch_proyectos_for_dashboard(
            session=session,
            start_date=start_date_str,
            end_date=end_date_str
        )
        
        fetch_time = time.time() - start_time
        print(f"   📊 Proyectos obtenidos: {len(proyectos)}")
        print(f"   ⏰ Tiempo fetch: {fetch_time:.3f}s")
        
        # Test del payload completo
        print("\n⏱️  PAYLOAD COMPLETO (SIN CONTEOS)")
        start_time = time.time()
        
        payload = build_proyectos_dashboard_payload(
            items=proyectos,
            start_date=start_date_str,
            end_date=end_date_str,
            session=session
        )
        
        total_time = time.time() - start_time
        print(f"   📈 Payload keys: {list(payload.keys())}")
        print(f"   ⏰ Tiempo total: {total_time:.3f}s")
        
        # Verificar que NO existen los KPIs eliminados
        print(f"\n🧹 VERIFICACIÓN DE LIMPIEZA")
        if 'kpis' in payload:
            print(f"   ❌ ERROR: Todavía existe la clave 'kpis'")
        else:
            print(f"   ✅ LIMPIO: Clave 'kpis' eliminada correctamente")
        
        # Verificar que SÍ existen los KPIs requeridos
        if 'kpis_nuevos' in payload:
            print(f"   ✅ CORRECTO: 'kpis_nuevos' presente")
            kpis_nuevos = payload['kpis_nuevos']
            print(f"       - Presupuestado: {'✅' if 'presupuestado' in kpis_nuevos else '❌'}")
            print(f"       - Real: {'✅' if 'real' in kpis_nuevos else '❌'}")
            print(f"       - Presupuesto Total: {'✅' if 'presupuesto_total' in kpis_nuevos else '❌'}")
            print(f"       - Real Total: {'✅' if 'real_total' in kpis_nuevos else '❌'}")
        else:
            print(f"   ❌ ERROR: 'kpis_nuevos' no encontrado")
        
        # Comparación de performance
        tiempo_anterior = 1.68  # Tiempo con conteos
        if total_time < tiempo_anterior:
            mejora = ((tiempo_anterior - total_time) / tiempo_anterior) * 100
            print(f"\n🎯 MEJORA ADICIONAL")
            print(f"   ⏰ Con conteos: {tiempo_anterior:.3f}s")
            print(f"   ⏰ Sin conteos: {total_time:.3f}s") 
            print(f"   📈 Mejora extra: {mejora:.1f}%")
        else:
            print(f"\n⚡ TIEMPO SIMILAR: {total_time:.3f}s vs {tiempo_anterior:.3f}s")
            
    except Exception as e:
        print(f"❌ Error en prueba: {e}")
        import traceback
        traceback.print_exc()
    finally:
        session.close()

if __name__ == "__main__":
    import asyncio
    asyncio.run(test_sin_conteos_innecesarios())