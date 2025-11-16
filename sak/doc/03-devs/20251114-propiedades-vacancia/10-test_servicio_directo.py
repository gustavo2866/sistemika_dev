"""
Test directo llamando al servicio desde Python para ver errores detallados.
"""

import sys
import os
from datetime import datetime

sys.path.insert(0, os.path.join(os.path.dirname(__file__), '..', '..', '..', 'backend'))

from app.db import get_session
from app.services.vacancia_dashboard import fetch_vacancias_for_dashboard, build_dashboard_payload
from sqlmodel import select
from app.models.vacancia import Vacancia

def main():
    start_date = "2023-01-01"
    end_date = datetime.now().date().isoformat()
    
    print(f"🔍 Fetching vacancias desde servicio...")
    print(f"   Rango: {start_date} a {end_date}\n")
    
    for session in get_session():
        # Ver cuántas vacancias hay en DB
        total_db = len(session.exec(select(Vacancia).where(Vacancia.deleted_at.is_(None))).all())
        print(f"📊 Vacancias en DB (no eliminadas): {total_db}\n")
        
        # Llamar al servicio
        try:
            items = fetch_vacancias_for_dashboard(
                session,
                start_date=start_date,
                end_date=end_date,
                estado_propiedad=None,
                propietario=None,
                ambientes=None
            )
            
            print(f"✅ Servicio retornó: {len(items)} items calculados\n")
            
            if len(items) == 0:
                print("⚠️  PROBLEMA: El servicio retorna 0 items cuando hay {total_db} en DB")
                print("   Esto indica que _calculate_for_vacancia está retornando None")
                print("   o está lanzando excepciones que se están omitiendo.\n")
                
                # Probar manualmente con una vacancia
                print("🔬 Probando cálculo manual con primera vacancia...\n")
                vacancias = session.exec(select(Vacancia).limit(5)).all()
                
                from app.services.vacancia_dashboard import _calculate_for_vacancia, _to_date
                
                start = _to_date(start_date)
                end = _to_date(end_date)
                today = datetime.now().date()
                
                for v in vacancias:
                    print(f"  Vacancia #{v.id}:")
                    print(f"    - Propiedad ID: {v.propiedad_id}")
                    print(f"    - Ciclo activo: {v.ciclo_activo}")
                    print(f"    - Fecha recibida: {v.fecha_recibida}")
                    print(f"    - Fecha alquilada: {v.fecha_alquilada}")
                    print(f"    - Fecha retirada: {v.fecha_retirada}")
                    
                    try:
                        calc = _calculate_for_vacancia(v, start=start, end=end, today=today)
                        if calc:
                            print(f"    ✅ Calculado: {calc.dias_totales} días totales")
                        else:
                            print(f"    ❌ _calculate_for_vacancia retornó None")
                            
                            # Analizar por qué
                            from app.services.vacancia_dashboard import _parse_date
                            fecha_recibida = _parse_date(v.fecha_recibida)
                            cierre_dt = v.fecha_alquilada or v.fecha_retirada
                            cierre = _parse_date(cierre_dt)
                            
                            print(f"       - fecha_recibida parsed: {fecha_recibida}")
                            print(f"       - end: {end}")
                            print(f"       - fecha_recibida > end? {fecha_recibida > end if fecha_recibida else 'N/A'}")
                            print(f"       - cierre parsed: {cierre}")
                            print(f"       - start: {start}")
                            print(f"       - cierre < start? {cierre < start if cierre else 'N/A'}")
                    except Exception as e:
                        print(f"    ❌ Error al calcular: {type(e).__name__}: {e}")
                    print()
            else:
                print("✅ Items calculados exitosamente\n")
                
                # Construir payload
                payload = build_dashboard_payload(items, start_date, end_date, limit_top=5)
                
                print("📊 Payload generado:")
                print(f"  KPIs:")
                for key, value in payload['kpis'].items():
                    print(f"    {key}: {value}")
                
                print(f"\n  Buckets: {len(payload['buckets'])}")
                print(f"  Estados: {payload['estados_finales']}")
                print(f"  Top items: {len(payload['top'])}")
                
        except Exception as e:
            print(f"❌ Error en servicio: {type(e).__name__}: {e}")
            import traceback
            traceback.print_exc()

if __name__ == "__main__":
    main()
