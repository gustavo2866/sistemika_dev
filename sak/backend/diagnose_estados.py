"""
Script de diagnóstico para verificar inconsistencias en el conteo de estados.
"""

import sys
from datetime import datetime
from sqlmodel import Session
from app.db import engine
from app.models.vacancia import Vacancia
from app.services.vacancia_dashboard import fetch_vacancias_for_dashboard, build_dashboard_payload

def diagnose_estados():
    """Diagnostica inconsistencias en el conteo de estados."""
    
    # Fechas de ejemplo (último año)
    end_date = datetime.now().strftime("%Y-%m-%d")
    start_date = (datetime.now().replace(year=datetime.now().year - 1)).strftime("%Y-%m-%d")
    
    print(f"\n{'='*80}")
    print(f"DIAGNÓSTICO DE ESTADOS DE VACANCIAS")
    print(f"{'='*80}\n")
    print(f"Rango: {start_date} a {end_date}\n")
    
    with Session(engine) as session:
        # Obtener datos procesados
        items = fetch_vacancias_for_dashboard(
            session=session,
            start_date=start_date,
            end_date=end_date,
        )
        
        payload = build_dashboard_payload(items, start_date=start_date, end_date=end_date)
        
        # Conteo manual
        activo_count = sum(1 for item in items if item.estado_corte == "Activo")
        alquilada_count = sum(1 for item in items if item.estado_corte == "Alquilada")
        retirada_count = sum(1 for item in items if item.estado_corte == "Retirada")
        
        print(f"Total de vacancias procesadas: {len(items)}\n")
        
        print(f"Conteo manual:")
        print(f"  - Activo: {activo_count}")
        print(f"  - Alquilada: {alquilada_count}")
        print(f"  - Retirada: {retirada_count}")
        print(f"  - Total: {activo_count + alquilada_count + retirada_count}\n")
        
        print(f"Estados finales del payload:")
        print(f"  - Activo: {payload['estados_finales']['activo']}")
        print(f"  - Alquilada: {payload['estados_finales']['alquilada']}")
        print(f"  - Retirada: {payload['estados_finales']['retirada']}")
        print(f"  - Total: {sum(payload['estados_finales'].values())}\n")
        
        # Verificar consistencia
        if (activo_count == payload['estados_finales']['activo'] and
            alquilada_count == payload['estados_finales']['alquilada'] and
            retirada_count == payload['estados_finales']['retirada']):
            print("✅ Conteos consistentes\n")
        else:
            print("❌ INCONSISTENCIA DETECTADA\n")
        
        # Mostrar detalles de retiradas
        print(f"{'='*80}")
        print(f"DETALLE DE VACANCIAS RETIRADAS")
        print(f"{'='*80}\n")
        
        retiradas = [item for item in items if item.estado_corte == "Retirada"]
        
        for i, item in enumerate(retiradas, 1):
            v = item.vacancia
            print(f"{i}. Vacancia #{v.id}")
            print(f"   Propiedad: {v.propiedad.nombre if v.propiedad else 'N/A'}")
            print(f"   Estado corte: {item.estado_corte}")
            print(f"   Bucket: {item.bucket}")
            print(f"   Fecha recibida: {v.fecha_recibida}")
            print(f"   Fecha alquilada: {v.fecha_alquilada}")
            print(f"   Fecha retirada: {v.fecha_retirada}")
            print(f"   Días totales: {item.dias_totales}")
            print()
        
        print(f"{'='*80}\n")
        
        # Verificar si hay vacancias sin cargar propiedad
        print("Verificando relaciones de propiedad...")
        vacancias_sin_prop = [item for item in items if not item.vacancia.propiedad]
        if vacancias_sin_prop:
            print(f"⚠️  Encontradas {len(vacancias_sin_prop)} vacancias sin propiedad cargada")
            for item in vacancias_sin_prop[:5]:
                print(f"   - Vacancia #{item.vacancia.id}, propiedad_id: {item.vacancia.propiedad_id}")
        else:
            print("✅ Todas las vacancias tienen propiedad cargada\n")

if __name__ == "__main__":
    try:
        diagnose_estados()
        sys.exit(0)
    except Exception as e:
        print(f"\n❌ Error en diagnóstico: {e}")
        import traceback
        traceback.print_exc()
        sys.exit(1)
