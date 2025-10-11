"""
Script para verificar y sincronizar esquemas entre bases de datos
"""
import os
from sqlalchemy import create_engine, text, inspect
from dotenv import load_dotenv

load_dotenv()

# URLs de las bases de datos
DB_LOCAL = "postgresql+psycopg://postgres:postgres@localhost:5432/sak_dev"
DB_NEON = os.getenv("DATABASE_URL")

def get_schema_info(engine, db_name):
    """Obtiene información del esquema de una base de datos"""
    print(f"\n📊 Analizando: {db_name}")
    print("="*60)
    
    inspector = inspect(engine)
    
    # Obtener tablas
    tables = inspector.get_table_names()
    print(f"\n✅ Total de tablas: {len(tables)}")
    
    schema_info = {}
    
    for table in sorted(tables):
        columns = inspector.get_columns(table)
        indexes = inspector.get_indexes(table)
        fks = inspector.get_foreign_keys(table)
        
        schema_info[table] = {
            'columns': [(c['name'], str(c['type'])) for c in columns],
            'column_count': len(columns),
            'indexes': len(indexes),
            'foreign_keys': len(fks)
        }
        
        print(f"   📋 {table}")
        print(f"      - Columnas: {len(columns)}")
        print(f"      - Índices: {len(indexes)}")
        print(f"      - Foreign Keys: {len(fks)}")
    
    # Verificar versión de Alembic
    with engine.connect() as conn:
        try:
            result = conn.execute(text("SELECT version_num FROM alembic_version"))
            version = result.fetchone()
            if version:
                print(f"\n🔖 Versión de Alembic: {version[0]}")
            else:
                print("\n⚠️  No hay versión de Alembic registrada")
        except Exception as e:
            print(f"\n⚠️  Tabla alembic_version no existe: {e}")
    
    return schema_info

def compare_schemas(local_schema, neon_schema):
    """Compara dos esquemas y muestra diferencias"""
    print("\n" + "="*60)
    print("🔍 COMPARACIÓN DE ESQUEMAS")
    print("="*60)
    
    local_tables = set(local_schema.keys())
    neon_tables = set(neon_schema.keys())
    
    # Tablas solo en local
    only_local = local_tables - neon_tables
    if only_local:
        print(f"\n⚠️  Tablas solo en LOCAL: {only_local}")
    
    # Tablas solo en Neon
    only_neon = neon_tables - local_tables
    if only_neon:
        print(f"\n⚠️  Tablas solo en NEON: {only_neon}")
    
    # Tablas en común
    common_tables = local_tables & neon_tables
    print(f"\n✅ Tablas en común: {len(common_tables)}")
    
    # Comparar estructura de tablas comunes
    differences = []
    for table in sorted(common_tables):
        local_cols = local_schema[table]['columns']
        neon_cols = neon_schema[table]['columns']
        
        if local_cols != neon_cols:
            differences.append(table)
            print(f"\n⚠️  Diferencias en tabla: {table}")
            print(f"   Local: {len(local_cols)} columnas")
            print(f"   Neon:  {len(neon_cols)} columnas")
            
            # Columnas diferentes
            local_col_names = {c[0] for c in local_cols}
            neon_col_names = {c[0] for c in neon_cols}
            
            only_in_local = local_col_names - neon_col_names
            if only_in_local:
                print(f"   📌 Solo en local: {only_in_local}")
            
            only_in_neon = neon_col_names - local_col_names
            if only_in_neon:
                print(f"   📌 Solo en neon: {only_in_neon}")
    
    if not differences and not only_local and not only_neon:
        print("\n✅ ¡LOS ESQUEMAS SON IDÉNTICOS!")
        return True
    else:
        print(f"\n❌ Se encontraron {len(differences)} diferencias en tablas comunes")
        return False

def check_alembic_version(engine, db_name):
    """Verifica la versión de Alembic en una base de datos"""
    with engine.connect() as conn:
        try:
            result = conn.execute(text("SELECT version_num FROM alembic_version"))
            version = result.fetchone()
            if version:
                return version[0]
            return None
        except Exception:
            return None

def main():
    print("="*60)
    print("🔄 VERIFICACIÓN DE SINCRONIZACIÓN DE ESQUEMAS")
    print("="*60)
    
    if not DB_NEON:
        print("❌ Error: DATABASE_URL no está configurada en .env")
        return
    
    # Conectar a ambas bases
    try:
        engine_local = create_engine(DB_LOCAL, echo=False)
        engine_neon = create_engine(DB_NEON, echo=False)
        
        # Verificar versiones de Alembic
        print("\n📌 Verificando versiones de Alembic...")
        local_version = check_alembic_version(engine_local, "LOCAL")
        neon_version = check_alembic_version(engine_neon, "NEON")
        
        print(f"   Local: {local_version or 'Sin migraciones'}")
        print(f"   Neon:  {neon_version or 'Sin migraciones'}")
        
        if local_version != neon_version:
            print("\n⚠️  ¡LAS VERSIONES DE ALEMBIC SON DIFERENTES!")
            print("   Necesitas aplicar migraciones para sincronizar.")
        else:
            print("\n✅ Versiones de Alembic coinciden")
        
        # Obtener información de esquemas
        local_schema = get_schema_info(engine_local, "LOCAL (PostgreSQL)")
        neon_schema = get_schema_info(engine_neon, "NEON (Producción)")
        
        # Comparar esquemas
        schemas_match = compare_schemas(local_schema, neon_schema)
        
        # Recomendaciones
        print("\n" + "="*60)
        print("💡 RECOMENDACIONES")
        print("="*60)
        
        if schemas_match and local_version == neon_version:
            print("\n✅ Todo está sincronizado correctamente")
            print("\n📝 Para mantener la sincronización:")
            print("   1. Siempre crea migraciones: alembic revision --autogenerate -m 'mensaje'")
            print("   2. Prueba en local: alembic upgrade head")
            print("   3. Aplica a Neon: cambiar DATABASE_URL y ejecutar alembic upgrade head")
        else:
            print("\n⚠️  Se requiere sincronización")
            
            if local_version and not neon_version:
                print("\n📝 Aplicar migraciones a Neon:")
                print("   1. Cambiar DATABASE_URL en .env a Neon")
                print("   2. alembic upgrade head")
            elif neon_version and not local_version:
                print("\n📝 Aplicar migraciones a Local:")
                print("   1. Cambiar DATABASE_URL en .env a Local")
                print("   2. alembic upgrade head")
            elif local_version != neon_version:
                # Determinar cuál está más adelante
                print("\n📝 Sincronizar versiones:")
                print("   Ver: alembic history")
                print("   Aplicar faltantes en la BD desactualizada")
        
    except Exception as e:
        print(f"\n❌ Error: {e}")
    finally:
        if 'engine_local' in locals():
            engine_local.dispose()
        if 'engine_neon' in locals():
            engine_neon.dispose()

if __name__ == "__main__":
    main()
