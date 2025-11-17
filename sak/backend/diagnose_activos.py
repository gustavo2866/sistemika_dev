#!/usr/bin/env python3
"""
Diagnóstico de vacancias con estado 'Activo' que tienen propiedades alquiladas
"""
from datetime import date, timedelta
from app.db import get_session
from app.models.vacancia import Vacancia
from sqlmodel import select
from sqlalchemy.orm import selectinload

def main():
    session = next(get_session())
    
    # Primero, ver qué fechas tenemos
    stmt = select(Vacancia)
    all_vacancias = session.exec(stmt).all()
    fechas = [v.fecha_recibida for v in all_vacancias if v.fecha_recibida]
    
    if fechas:
        print(f"Total vacancias en BD: {len(all_vacancias)}")
        print(f"Con fecha_recibida: {len(fechas)}")
        print(f"Rango de fechas: {min(fechas)} a {max(fechas)}")
    else:
        print("No hay vacancias con fecha_recibida")
        return
    
    # Ahora usar fetch_vacancias_for_dashboard con un rango apropiado
    from app.services.vacancia_dashboard import fetch_vacancias_for_dashboard
    
    # Usar un rango amplio basado en los datos reales
    min_fecha = min(fechas).date() if hasattr(min(fechas), 'date') else min(fechas)
    max_fecha = max(fechas).date() if hasattr(max(fechas), 'date') else max(fechas)
    
    today = date.today()
    start = min_fecha.strftime('%Y-%m-%d')
    end = max(max_fecha, today).strftime('%Y-%m-%d')
    
    print(f"\n{'='*80}")
    print(f"Analizando rango: {start} a {end}")
    print(f"{'='*80}\n")
    
    items = fetch_vacancias_for_dashboard(session, start, end)
    
    print(f"\nTotal vacancias en rango: {len(items)}")
    
    # Agrupar por estado_corte
    from collections import defaultdict
    by_estado_corte = defaultdict(list)
    for item in items:
        by_estado_corte[item.estado_corte].append(item)
    
    print(f"\nDistribución por estado_corte:")
    for estado, lista in by_estado_corte.items():
        print(f"  {estado}: {len(lista)}")
    
    # Analizar "Activo" en detalle
    activos = by_estado_corte.get("Activo", [])
    if activos:
        print(f"\n{'='*80}")
        print(f"Análisis de vacancias con estado_corte='Activo' ({len(activos)} vacancias)")
        print(f"{'='*80}")
        
        # Agrupar activos por estado de propiedad
        by_prop_estado = defaultdict(list)
        for item in activos:
            prop_estado = item.vacancia.propiedad.estado if item.vacancia.propiedad else "sin_propiedad"
            by_prop_estado[prop_estado].append(item)
        
        print(f"\nDistribución por estado de propiedad:")
        for prop_estado, lista in sorted(by_prop_estado.items()):
            print(f"  {prop_estado}: {len(lista)}")
        
        # Mostrar detalles de alquiladas
        if "4-alquilada" in by_prop_estado:
            print(f"\n{'='*80}")
            print(f"⚠️  PROBLEMA DETECTADO: Vacancias 'Activo' con propiedad '4-alquilada'")
            print(f"{'='*80}")
            alquiladas = by_prop_estado["4-alquilada"]
            print(f"\nTotal: {len(alquiladas)} vacancias\n")
            
            for item in alquiladas[:10]:
                v = item.vacancia
                prop = v.propiedad
                print(f"Vacancia ID {v.id}:")
                print(f"  Propiedad: #{prop.id} - {prop.nombre} - Estado: {prop.estado}")
                print(f"  Ciclo activo: {v.ciclo_activo}")
                print(f"  Fecha recibida: {v.fecha_recibida}")
                print(f"  Fecha alquilada: {v.fecha_alquilada}")
                print(f"  Fecha retirada: {v.fecha_retirada}")
                print(f"  Estado corte: {item.estado_corte}")
                print(f"  Días totales: {item.dias_totales}")
                print()
    else:
        print("\n✅ No hay vacancias con estado_corte='Activo'")

if __name__ == "__main__":
    main()
