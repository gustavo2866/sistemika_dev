#!/usr/bin/env python3
"""Script para verificar columnas usando la configuración de la app"""

import sys
import os

# Agregar el directorio backend al path
backend_path = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, backend_path)

try:
    from sqlalchemy import create_engine, text
    from sqlalchemy.engine import Inspector
    from app.db import DATABASE_URL
    
    print(f"Conectando a la base de datos...")
    print(f"URL (oculta): {DATABASE_URL[:20]}...{DATABASE_URL[-20:] if DATABASE_URL else 'None'}")
    
    engine = create_engine(DATABASE_URL)
    
    # Verificar conexión con una consulta simple
    with engine.connect() as conn:
        result = conn.execute(text("SELECT current_database(), current_user"))
        db_info = result.fetchone()
        print(f"Conectado a: {db_info[0]} como usuario: {db_info[1]}")
    
    # Obtener información de la tabla
    inspector = Inspector.from_engine(engine)
    
    print("\n" + "="*60)
    print("ESTRUCTURA DE LA TABLA po_ordenes_compra")
    print("="*60)
    
    columns = inspector.get_columns('po_ordenes_compra')
    
    # Campos que acabamos de agregar
    new_fields = ['fecha', 'fecha_estado']
    found_new_fields = []
    
    for col in columns:
        nullable_text = "NULL" if col["nullable"] else "NOT NULL"
        marker = "🆕 " if col["name"] in new_fields else "   "
        print(f'{marker}{col["name"]:<25} {str(col["type"]):<20} {nullable_text}')
        
        if col["name"] in new_fields:
            found_new_fields.append(col["name"])
    
    print("\n" + "="*60)
    print("RESUMEN DE VERIFICACIÓN")
    print("="*60)
    
    if len(found_new_fields) == len(new_fields):
        print("✅ ÉXITO: Ambos campos se agregaron correctamente!")
        print(f"   Campos agregados: {', '.join(found_new_fields)}")
        
        # Mostrar detalles de los nuevos campos
        print("\n📋 DETALLES DE LOS NUEVOS CAMPOS:")
        for col in columns:
            if col['name'] in new_fields:
                print(f"   • {col['name']}:")
                print(f"     - Tipo: {col['type']}")
                print(f"     - Nullable: {'Sí' if col['nullable'] else 'No'}")
                if col.get('default'):
                    print(f"     - Default: {col['default']}")
    else:
        missing = [field for field in new_fields if field not in found_new_fields]
        print(f"❌ ERROR: Faltan campos: {missing}")
        print(f"   Campos encontrados: {found_new_fields}")

except ImportError as e:
    print(f"Error al importar módulos: {e}")
    print("Asegúrate de estar en el directorio backend y que las dependencias estén instaladas")
except Exception as e:
    print(f"Error: {e}")