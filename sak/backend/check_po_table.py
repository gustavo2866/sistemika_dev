#!/usr/bin/env python3
"""Script para verificar la estructura de la tabla po_ordenes_compra"""

import os
from sqlalchemy import create_engine, text
from sqlalchemy.engine import Inspector

def main():
    # Obtener la URL de la base de datos desde las variables de entorno
    database_url = os.getenv('DATABASE_URL')
    if not database_url:
        print('ERROR: DATABASE_URL no está configurada')
        return

    try:
        engine = create_engine(database_url)
        inspector = Inspector.from_engine(engine)

        print('Columnas en la tabla po_ordenes_compra:')
        print('=' * 50)
        
        columns = inspector.get_columns('po_ordenes_compra')
        for col in columns:
            nullable_text = "NULL" if col["nullable"] else "NOT NULL"
            print(f'  - {col["name"]:<25} {str(col["type"]):<20} {nullable_text}')
            
        # Verificar específicamente los nuevos campos
        new_fields = ['fecha', 'fecha_estado']
        found_fields = [col['name'] for col in columns if col['name'] in new_fields]

        print('\n' + '=' * 50)
        print(f'Campos nuevos encontrados: {found_fields}')
        
        if len(found_fields) == len(new_fields):
            print('✅ Todos los campos se agregaron correctamente!')
        else:
            missing = [field for field in new_fields if field not in found_fields]
            print(f'❌ Faltan campos: {missing}')
            
        # Mostrar información específica de los nuevos campos si existen
        for col in columns:
            if col['name'] in new_fields:
                print(f'\n📋 Campo {col["name"]}:')
                print(f'   Tipo: {col["type"]}')
                print(f'   Nullable: {col["nullable"]}')
                print(f'   Default: {col.get("default", "None")}')

    except Exception as e:
        print(f'Error al conectar con la base de datos: {e}')

if __name__ == '__main__':
    main()