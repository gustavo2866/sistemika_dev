from sqlalchemy import text
from app.db import engine

def get_table_schema(table_name):
    """Obtiene el esquema de una tabla"""
    query = text("""
        SELECT 
            column_name,
            data_type,
            character_maximum_length,
            is_nullable,
            column_default,
            numeric_precision,
            numeric_scale
        FROM information_schema.columns 
        WHERE table_name = :table_name
        ORDER BY ordinal_position
    """)
    
    with engine.connect() as conn:
        result = conn.execute(query, {"table_name": table_name})
        columns = []
        for row in result:
            column_info = {
                'name': row[0],
                'type': row[1],
                'max_length': row[2],
                'nullable': row[3] == 'YES',
                'default': row[4],
                'precision': row[5],
                'scale': row[6]
            }
            columns.append(column_info)
        return columns

def get_foreign_keys(table_name):
    """Obtiene las foreign keys de una tabla"""
    query = text("""
        SELECT 
            kcu.column_name,
            ccu.table_name AS foreign_table_name,
            ccu.column_name AS foreign_column_name
        FROM information_schema.table_constraints AS tc 
        JOIN information_schema.key_column_usage AS kcu
            ON tc.constraint_name = kcu.constraint_name
        JOIN information_schema.constraint_column_usage AS ccu
            ON ccu.constraint_name = tc.constraint_name
        WHERE constraint_type = 'FOREIGN KEY' AND tc.table_name = :table_name
        ORDER BY kcu.column_name
    """)
    
    with engine.connect() as conn:
        result = conn.execute(query, {"table_name": table_name})
        fks = []
        for row in result:
            fks.append({
                'column': row[0],
                'references_table': row[1],
                'references_column': row[2]
            })
        return fks

print("=== VERIFICACIÓN ESQUEMA PO_FACTURAS ===\n")

tables_to_check = ['po_facturas', 'po_factura_detalles', 'po_factura_impuestos']

for table_name in tables_to_check:
    print(f"--- Tabla: {table_name} ---")
    
    # Obtener esquema
    columns = get_table_schema(table_name)
    print("Columnas:")
    for col in columns:
        type_info = col['type']
        if col['max_length']:
            type_info += f"({col['max_length']})"
        elif col['precision'] and col['scale']:
            type_info += f"({col['precision']},{col['scale']})"
        
        nullable_str = "NULL" if col['nullable'] else "NOT NULL"
        default_str = f" DEFAULT {col['default']}" if col['default'] else ""
        
        print(f"  - {col['name']}: {type_info} {nullable_str}{default_str}")
    
    # Obtener foreign keys
    fks = get_foreign_keys(table_name)
    if fks:
        print("Foreign Keys:")
        for fk in fks:
            print(f"  - {fk['column']} -> {fk['references_table']}.{fk['references_column']}")
    
    print()

print("=== FIN VERIFICACIÓN ===")