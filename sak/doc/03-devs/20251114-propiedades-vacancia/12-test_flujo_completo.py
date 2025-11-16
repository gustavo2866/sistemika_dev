"""
Test completo del flujo: servicio + payload.
"""

import sys
import os
from datetime import datetime

sys.path.insert(0, os.path.join(os.path.dirname(__file__), '..', '..', '..', 'backend'))

from app.db import get_session
from app.services.vacancia_dashboard import fetch_vacancias_for_dashboard, build_dashboard_payload

def main():
    start_date = "2023-01-01"
    end_date = datetime.now().date().isoformat()
    
    print(f"🧪 Test completo del flujo dashboard\n")
    print(f"   Rango: {start_date} a {end_date}\n")
    
    for session in get_session():
        print("Paso 1: fetch_vacancias_for_dashboard")
        items = fetch_vacancias_for_dashboard(
            session,
            start_date=start_date,
            end_date=end_date
        )
        print(f"  ✅ Retornó: {len(items)} items\n")
        
        if len(items) == 0:
            print("❌ No hay items para construir payload")
            return
        
        print("Paso 2: build_dashboard_payload")
        try:
            payload = build_dashboard_payload(items, start_date, end_date, limit_top=10)
            print(f"  ✅ Payload construido exitosamente\n")
            
            print("📊 Contenido del payload:")
            print(f"\n  range:")
            print(f"    start: {payload['range']['start']}")
            print(f"    end: {payload['range']['end']}")
            
            print(f"\n  kpis:")
            for key, value in payload['kpis'].items():
                print(f"    {key}: {value}")
            
            print(f"\n  buckets: {len(payload['buckets'])} encontrados")
            for bucket in payload['buckets'][:5]:
                print(f"    {bucket['bucket']:12} - {bucket['count']:2} vacancias, "
                      f"{bucket['dias_totales']:4} días totales")
            
            print(f"\n  estados_finales:")
            for estado, count in payload['estados_finales'].items():
                print(f"    {estado}: {count}")
            
            print(f"\n  top: {len(payload['top'])} items")
            for i, item in enumerate(payload['top'][:3], 1):
                v = item['vacancia']
                print(f"    {i}. Propiedad #{v.propiedad_id} - {item['dias_totales']} días")
            
            print(f"\n✅ TODO EL FLUJO FUNCIONA CORRECTAMENTE")
            print(f"\n🔍 Si el endpoint retorna 0 items, el problema está en:")
            print(f"   1. La configuración del router")
            print(f"   2. El filtrado de respuesta (filtrar_respuesta)")
            print(f"   3. La serialización JSON")
            
        except Exception as e:
            print(f"  ❌ Error construyendo payload: {type(e).__name__}: {e}")
            import traceback
            traceback.print_exc()

if __name__ == "__main__":
    main()
