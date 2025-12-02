import sys
import os
sys.path.insert(0, os.path.dirname(__file__))

from sqlalchemy import inspect
from app.db import engine

def mostrar_columnas_eventos():
    inspector = inspect(engine)
    
    # Obtener columnas de la tabla crm_eventos
    columns = inspector.get_columns('crm_eventos')
    
    print("Columnas de la tabla crm_eventos:")
    print("=" * 60)
    
    for col in columns:
        nullable = "NULL" if col['nullable'] else "NOT NULL"
        default = f"DEFAULT {col['default']}" if col['default'] else ""
        print(f"{col['name']:20} {str(col['type']):20} {nullable:10} {default}")
    
    print("\n" + "=" * 60)
    print(f"Total de columnas: {len(columns)}")

if __name__ == "__main__":
    mostrar_columnas_eventos()
