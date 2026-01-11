from app.db import engine
from sqlmodel import text

def check_table_structure():
    with engine.connect() as conn:
        # Verificar estructura de la tabla po_orden_compra_detalles
        result = conn.execute(text("""
            SELECT column_name, data_type, is_nullable, column_default
            FROM information_schema.columns 
            WHERE table_name = 'po_orden_compra_detalles'
            ORDER BY ordinal_position;
        """))
        
        print("Estructura de la tabla po_orden_compra_detalles:")
        for row in result:
            print(f"  {row[0]} | {row[1]} | nullable: {row[2]} | default: {row[3]}")
        
        # Verificar constraints
        print("\nConstraints:")
        result = conn.execute(text("""
            SELECT constraint_name, constraint_type
            FROM information_schema.table_constraints 
            WHERE table_name = 'po_orden_compra_detalles';
        """))
        
        for row in result:
            print(f"  {row[0]} | {row[1]}")
        
        # Verificar foreign keys
        print("\nForeign Keys:")
        result = conn.execute(text("""
            SELECT
                kcu.column_name,
                ccu.table_name AS foreign_table_name,
                ccu.column_name AS foreign_column_name 
            FROM 
                information_schema.key_column_usage AS kcu
                INNER JOIN information_schema.constraint_column_usage AS ccu
                    ON kcu.constraint_name = ccu.constraint_name
                INNER JOIN information_schema.table_constraints AS tc 
                    ON kcu.constraint_name = tc.constraint_name
            WHERE 
                kcu.table_name = 'po_orden_compra_detalles' AND tc.constraint_type = 'FOREIGN KEY';
        """))
        
        for row in result:
            print(f"  {row[0]} -> {row[1]}.{row[2]}")

if __name__ == "__main__":
    check_table_structure()