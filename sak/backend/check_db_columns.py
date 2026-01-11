#!/usr/bin/env python
"""Script para verificar columnas en la base de datos"""

from app.models import *
from app.core.database import engine
import sqlalchemy as sa

def check_columns():
    inspector = sa.inspect(engine)
    print("Verificando columnas en po_ordenes_compra:")
    
    try:
        cols = inspector.get_columns('po_ordenes_compra')
        for col in cols:
            if 'centro_costo' in col['name'] or 'tipo_solicitud' in col['name']:
                print(f"  {col['name']}: {col['type']} - nullable: {col.get('nullable', 'Unknown')}")
    except Exception as e:
        print(f"Error verificando columnas: {e}")
        
    print("\nVerificando foreign keys:")
    try:
        fks = inspector.get_foreign_keys('po_ordenes_compra')
        for fk in fks:
            if 'centro_costo' in fk['name'] or 'tipo_solicitud' in fk['name']:
                print(f"  {fk['name']}: {fk['constrained_columns']} -> {fk['referred_table']}.{fk['referred_columns']}")
    except Exception as e:
        print(f"Error verificando foreign keys: {e}")

if __name__ == "__main__":
    check_columns()