"""
Test para identificar dónde falla el query en fetch_vacancias_for_dashboard.
"""

import sys
import os
from datetime import datetime

sys.path.insert(0, os.path.join(os.path.dirname(__file__), '..', '..', '..', 'backend'))

from app.db import get_session
from app.models.vacancia import Vacancia
from app.models.propiedad import Propiedad
from sqlmodel import select
from sqlalchemy.orm import selectinload

def main():
    print("🔬 Diagnosticando query de fetch_vacancias_for_dashboard\n")
    
    for session in get_session():
        # Test 1: Query básico sin selectinload
        print("Test 1: Query básico sin joins")
        query1 = select(Vacancia).where(Vacancia.deleted_at.is_(None))
        vacancias1 = session.exec(query1).all()
        print(f"  ✅ Retornó: {len(vacancias1)} vacancias\n")
        
        # Test 2: Query con selectinload (como en el servicio)
        print("Test 2: Query con selectinload(Vacancia.propiedad)")
        query2 = select(Vacancia).options(selectinload(Vacancia.propiedad)).where(Vacancia.deleted_at.is_(None))
        try:
            vacancias2 = session.exec(query2).all()
            print(f"  ✅ Retornó: {len(vacancias2)} vacancias\n")
            
            # Verificar que la relación funciona
            if len(vacancias2) > 0:
                v = vacancias2[0]
                print(f"  Verificando relación en vacancia #{v.id}:")
                print(f"    - propiedad_id: {v.propiedad_id}")
                try:
                    prop = v.propiedad
                    if prop:
                        print(f"    - propiedad cargada: #{prop.id} - {prop.nombre}")
                    else:
                        print(f"    ⚠️  propiedad es None (relación no cargada)")
                except Exception as e:
                    print(f"    ❌ Error al acceder a propiedad: {e}")
        except Exception as e:
            print(f"  ❌ Error en query: {type(e).__name__}: {e}\n")
            import traceback
            traceback.print_exc()
            return
        
        # Test 3: Verificar que todas las vacancias tienen propiedad válida
        print("\nTest 3: Verificar integridad referencial")
        vacancias_sin_propiedad = []
        for v in vacancias2[:10]:  # Solo primeras 10
            if not v.propiedad:
                vacancias_sin_propiedad.append(v.id)
        
        if vacancias_sin_propiedad:
            print(f"  ⚠️  Vacancias sin propiedad: {vacancias_sin_propiedad}")
        else:
            print(f"  ✅ Todas las vacancias tienen propiedad válida (primeras 10 verificadas)\n")
        
        # Test 4: Reproducir exactamente el query del servicio
        print("Test 4: Query exacto del servicio (sin filtros)")
        from app.services.vacancia_dashboard import _calculate_for_vacancia, _to_date
        
        start = _to_date("2023-01-01")
        end = _to_date(datetime.now().date().isoformat())
        today = datetime.now().date()
        cut = min(end, today)
        
        query = select(Vacancia).options(selectinload(Vacancia.propiedad)).where(Vacancia.deleted_at.is_(None))
        vacancias = session.exec(query).all()
        print(f"  Query retornó: {len(vacancias)} vacancias")
        
        calculated = []
        errores = []
        none_results = []
        
        for vacancia in vacancias:
            try:
                calc = _calculate_for_vacancia(vacancia, start=start, end=cut, today=today)
                if calc:
                    calculated.append(calc)
                else:
                    none_results.append(vacancia.id)
            except Exception as e:
                errores.append((vacancia.id, str(e)))
        
        print(f"  Calculados exitosamente: {len(calculated)}")
        print(f"  Retornaron None: {len(none_results)}")
        print(f"  Lanzaron error: {len(errores)}\n")
        
        if none_results:
            print(f"  ⚠️  Vacancias que retornaron None: {none_results[:10]}")
            print(f"     Analizando primera...\n")
            v_none = session.get(Vacancia, none_results[0])
            if v_none:
                from app.services.vacancia_dashboard import _parse_date
                fecha_recibida = _parse_date(v_none.fecha_recibida)
                cierre_dt = v_none.fecha_alquilada or v_none.fecha_retirada
                cierre = _parse_date(cierre_dt)
                
                print(f"     Vacancia #{v_none.id}:")
                print(f"       - fecha_recibida: {v_none.fecha_recibida}")
                print(f"       - fecha_recibida parsed: {fecha_recibida}")
                print(f"       - end: {end}")
                print(f"       - Condición (fecha_recibida > end): {fecha_recibida > end if fecha_recibida else 'N/A'}")
                print(f"       - cierre: {cierre}")
                print(f"       - start: {start}")
                print(f"       - Condición (cierre < start): {cierre < start if cierre else 'N/A'}")
        
        if errores:
            print(f"\n  ❌ Errores encontrados:")
            for v_id, error in errores[:5]:
                print(f"     Vacancia #{v_id}: {error}")

if __name__ == "__main__":
    main()
