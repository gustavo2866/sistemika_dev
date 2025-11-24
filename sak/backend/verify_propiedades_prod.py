"""
Verificar campos nuevos de propiedades en producción
"""
import subprocess
from sqlalchemy import create_engine, text

def get_production_database_url():
    """Obtener DATABASE_URL de producción desde GCP Secret Manager"""
    try:
        result = subprocess.run(
            ["powershell", "-Command", 
             "gcloud secrets versions access latest --secret=DATABASE_URL --project=sak-wcl"],
            capture_output=True,
            text=True,
            check=True,
            shell=True
        )
        return result.stdout.strip()
    except subprocess.CalledProcessError as e:
        print(f"❌ Error al obtener DATABASE_URL: {e}")
        return None

def check_propiedades_columns():
    """Verificar columnas de la tabla propiedades"""
    print("\n" + "="*70)
    print("VERIFICANDO COLUMNAS DE PROPIEDADES EN PRODUCCIÓN")
    print("="*70)
    
    prod_db_url = get_production_database_url()
    if not prod_db_url:
        return
    
    engine = create_engine(prod_db_url)
    
    query = """
    SELECT column_name, data_type, is_nullable
    FROM information_schema.columns
    WHERE table_name = 'propiedades'
    AND column_name IN (
        'tipo_operacion_id',
        'emprendimiento_id', 
        'costo_propiedad',
        'costo_moneda_id',
        'precio_venta_estimado',
        'precio_moneda_id'
    )
    ORDER BY column_name;
    """
    
    try:
        with engine.connect() as conn:
            result = conn.execute(text(query))
            columns = result.fetchall()
            
            if columns:
                print("\n✅ Columnas nuevas encontradas:")
                print(f"\n{'Columna':<25} {'Tipo':<20} {'Nullable':<10}")
                print("-" * 60)
                for col in columns:
                    print(f"{col[0]:<25} {col[1]:<20} {col[2]:<10}")
            else:
                print("\n❌ No se encontraron las columnas nuevas")
                
            # Verificar índices
            print("\n" + "="*70)
            print("VERIFICANDO ÍNDICES")
            print("="*70)
            
            index_query = """
            SELECT indexname, indexdef
            FROM pg_indexes
            WHERE tablename = 'propiedades'
            AND (indexname LIKE '%tipo_operacion%' OR indexname LIKE '%emprendimiento%')
            ORDER BY indexname;
            """
            
            result = conn.execute(text(index_query))
            indexes = result.fetchall()
            
            if indexes:
                print("\n✅ Índices encontrados:")
                for idx in indexes:
                    print(f"  - {idx[0]}")
            else:
                print("\n⚠️  No se encontraron índices nuevos")
                
            # Verificar foreign keys
            print("\n" + "="*70)
            print("VERIFICANDO FOREIGN KEYS")
            print("="*70)
            
            fk_query = """
            SELECT
                tc.constraint_name,
                kcu.column_name,
                ccu.table_name AS foreign_table_name
            FROM information_schema.table_constraints AS tc
            JOIN information_schema.key_column_usage AS kcu
                ON tc.constraint_name = kcu.constraint_name
            JOIN information_schema.constraint_column_usage AS ccu
                ON ccu.constraint_name = tc.constraint_name
            WHERE tc.constraint_type = 'FOREIGN KEY'
                AND tc.table_name = 'propiedades'
                AND kcu.column_name IN (
                    'tipo_operacion_id',
                    'emprendimiento_id',
                    'costo_moneda_id',
                    'precio_moneda_id'
                )
            ORDER BY kcu.column_name;
            """
            
            result = conn.execute(text(fk_query))
            fks = result.fetchall()
            
            if fks:
                print("\n✅ Foreign keys encontradas:")
                for fk in fks:
                    print(f"  - {fk[1]} -> {fk[2]}")
            else:
                print("\n⚠️  No se encontraron foreign keys nuevas")
                
            print("\n" + "="*70)
            print("✅ VERIFICACIÓN COMPLETADA")
            print("="*70)
            
    except Exception as e:
        print(f"\n❌ Error: {e}")
        import traceback
        traceback.print_exc()

if __name__ == "__main__":
    check_propiedades_columns()
