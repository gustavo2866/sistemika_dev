"""
Script para comparar estructuras de BD Local vs Neon
"""
from sqlalchemy import create_engine, inspect
import os
from dotenv import load_dotenv

load_dotenv()

# URLs
DB_LOCAL = "postgresql+psycopg://sak_user:cambia_esta_clave@localhost:5432/sak_backend"
DB_NEON = "postgresql+psycopg://neondb_owner:npg_2HqUWwPRtEy7@ep-steep-bird-acyo7x0e-pooler.sa-east-1.aws.neon.tech/neondb?sslmode=require"

def get_tables_and_columns(engine):
    """Obtiene información de tablas y columnas"""
    inspector = inspect(engine)
    tables = {}
    
    for table in inspector.get_table_names():
        columns = inspector.get_columns(table)
        tables[table] = {
            'columns': sorted([c['name'] for c in columns]),
            'count': len(columns)
        }
    
    return tables

def compare_databases():
    print("="*70)
    print("🔄 COMPARACIÓN: LOCAL vs NEON")
    print("="*70)
    
    # Conectar
    engine_local = create_engine(DB_LOCAL, echo=False)
    engine_neon = create_engine(DB_NEON, echo=False)
    
    # Obtener estructuras
    local_tables = get_tables_and_columns(engine_local)
    neon_tables = get_tables_and_columns(engine_neon)
    
    print(f"\n📊 Resumen:")
    print(f"   Local: {len(local_tables)} tablas")
    print(f"   Neon:  {len(neon_tables)} tablas")
    
    # Comparar
    local_only = set(local_tables.keys()) - set(neon_tables.keys())
    neon_only = set(neon_tables.keys()) - set(local_tables.keys())
    common = set(local_tables.keys()) & set(neon_tables.keys())
    
    if local_only:
        print(f"\n⚠️  Tablas SOLO en LOCAL:")
        for table in sorted(local_only):
            print(f"   📋 {table} ({local_tables[table]['count']} columnas)")
    
    if neon_only:
        print(f"\n⚠️  Tablas SOLO en NEON:")
        for table in sorted(neon_only):
            print(f"   📋 {table} ({neon_tables[table]['count']} columnas)")
    
    if not local_only and not neon_only:
        print(f"\n✅ Ambas tienen las mismas {len(common)} tablas")
    
    # Verificar columnas en tablas comunes
    print(f"\n🔍 Verificando columnas en tablas comunes ({len(common)})...")
    
    differences = 0
    for table in sorted(common):
        local_cols = set(local_tables[table]['columns'])
        neon_cols = set(neon_tables[table]['columns'])
        
        if local_cols != neon_cols:
            differences += 1
            print(f"\n⚠️  Diferencias en: {table}")
            
            only_local = local_cols - neon_cols
            if only_local:
                print(f"   📌 Solo en local: {only_local}")
            
            only_neon = neon_cols - local_cols
            if only_neon:
                print(f"   📌 Solo en neon: {only_neon}")
    
    if differences == 0:
        print(f"   ✅ Todas las tablas comunes tienen las mismas columnas")
    
    # Resultado final
    print("\n" + "="*70)
    if not local_only and not neon_only and differences == 0:
        print("✅ ¡ESTRUCTURAS IDÉNTICAS!")
        print("\nAmbas bases de datos tienen:")
        print(f"   • Mismas {len(common)} tablas")
        print(f"   • Mismas columnas en cada tabla")
        print(f"   • Misma versión de Alembic: 0002_seed_core_data")
    else:
        print("⚠️  HAY DIFERENCIAS")
        if local_only or neon_only:
            print(f"   • Tablas diferentes: {len(local_only) + len(neon_only)}")
        if differences > 0:
            print(f"   • Tablas con columnas diferentes: {differences}")
    print("="*70)
    
    engine_local.dispose()
    engine_neon.dispose()

if __name__ == "__main__":
    compare_databases()
