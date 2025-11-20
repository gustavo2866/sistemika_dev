#!/usr/bin/env python
"""Script para verificar el estado de los datos CRM en la base de datos."""

from sqlmodel import Session, select
from app.db import engine
from app.models import Propiedad

def check_propiedades_crm():
    session = Session(engine)
    
    props = session.exec(select(Propiedad)).all()
    print(f"Total propiedades: {len(props)}\n")
    
    con_datos = 0
    sin_datos = 0
    
    print("Estado de campos CRM en propiedades:")
    print("-" * 80)
    
    for p in props[:5]:  # Mostrar primeras 5
        print(f"\nID {p.id}: {p.nombre}")
        print(f"  tipo_operacion_id: {p.tipo_operacion_id}")
        print(f"  emprendimiento_id: {p.emprendimiento_id}")
        print(f"  costo_propiedad: {p.costo_propiedad}")
        print(f"  costo_moneda_id: {p.costo_moneda_id}")
        print(f"  precio_venta_estimado: {p.precio_venta_estimado}")
        print(f"  precio_moneda_id: {p.precio_moneda_id}")
        
        if p.tipo_operacion_id or p.emprendimiento_id or p.costo_propiedad:
            con_datos += 1
        else:
            sin_datos += 1
    
    # Contar todas
    for p in props:
        if p.tipo_operacion_id or p.emprendimiento_id or p.costo_propiedad:
            con_datos += 1
        else:
            sin_datos += 1
    
    print("\n" + "=" * 80)
    print(f"Resumen:")
    print(f"  Propiedades con datos CRM: {con_datos}")
    print(f"  Propiedades sin datos CRM: {sin_datos}")
    
    session.close()

if __name__ == "__main__":
    check_propiedades_crm()
