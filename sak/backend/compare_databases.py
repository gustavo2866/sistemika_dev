"""
Script para comparar estructuras de bases de datos local y producción.
Verifica que ambas bases tengan las mismas tablas, columnas, tipos de datos e índices.
"""
import os
from sqlalchemy import create_engine, inspect, text
from sqlalchemy.engine import reflection

# Configuración de bases de datos
LOCAL_DB = "postgresql+psycopg://postgres:postgres@localhost:5432/sak"
PRODUCTION_DB = "postgresql+psycopg://neondb_owner:npg_2HqUWwPRtEy7@ep-steep-bird-acyo7x0e-pooler.sa-east-1.aws.neon.tech/neondb?sslmode=require"

def get_database_structure(connection_string, db_name):
    """Obtiene la estructura completa de una base de datos."""
    engine = create_engine(connection_string)
    inspector = inspect(engine)
    
    structure = {
        'tables': {},
        'indexes': {}
    }
    
    # Obtener todas las tablas (excluyendo alembic_version)
    tables = [t for t in inspector.get_table_names() if t != 'alembic_version']
    
    for table_name in sorted(tables):
        # Columnas
        columns = {}
        for col in inspector.get_columns(table_name):
            col_info = {
                'type': str(col['type']),
                'nullable': col['nullable'],
                'default': str(col.get('default', None))
            }
            columns[col['name']] = col_info
        
        # Primary Keys
        pk = inspector.get_pk_constraint(table_name)
        primary_keys = pk.get('constrained_columns', []) if pk else []
        
        # Foreign Keys
        foreign_keys = []
        for fk in inspector.get_foreign_keys(table_name):
            fk_info = {
                'columns': fk['constrained_columns'],
                'referred_table': fk['referred_table'],
                'referred_columns': fk['referred_columns']
            }
            foreign_keys.append(fk_info)
        
        structure['tables'][table_name] = {
            'columns': columns,
            'primary_keys': primary_keys,
            'foreign_keys': foreign_keys
        }
        
        # Índices
        indexes = []
        for idx in inspector.get_indexes(table_name):
            idx_info = {
                'columns': idx['column_names'],
                'unique': idx['unique']
            }
            indexes.append((idx['name'], idx_info))
        structure['indexes'][table_name] = sorted(indexes)
    
    engine.dispose()
    return structure

def compare_structures(local_struct, prod_struct):
    """Compara dos estructuras de base de datos."""
    differences = []
    warnings = []
    
    # Comparar tablas
    local_tables = set(local_struct['tables'].keys())
    prod_tables = set(prod_struct['tables'].keys())
    
    missing_in_prod = local_tables - prod_tables
    missing_in_local = prod_tables - local_tables
    
    if missing_in_prod:
        differences.append(f"❌ Tablas en LOCAL pero NO en PRODUCCIÓN: {', '.join(sorted(missing_in_prod))}")
    
    if missing_in_local:
        differences.append(f"❌ Tablas en PRODUCCIÓN pero NO en LOCAL: {', '.join(sorted(missing_in_local))}")
    
    # Comparar estructura de tablas comunes
    common_tables = local_tables & prod_tables
    
    for table in sorted(common_tables):
        local_cols = set(local_struct['tables'][table]['columns'].keys())
        prod_cols = set(prod_struct['tables'][table]['columns'].keys())
        
        # Columnas faltantes
        missing_cols_prod = local_cols - prod_cols
        missing_cols_local = prod_cols - local_cols
        
        if missing_cols_prod:
            differences.append(f"❌ Tabla '{table}': columnas en LOCAL pero NO en PROD: {', '.join(sorted(missing_cols_prod))}")
        
        if missing_cols_local:
            differences.append(f"❌ Tabla '{table}': columnas en PROD pero NO en LOCAL: {', '.join(sorted(missing_cols_local))}")
        
        # Comparar tipos de datos para columnas comunes
        common_cols = local_cols & prod_cols
        for col in common_cols:
            local_col = local_struct['tables'][table]['columns'][col]
            prod_col = prod_struct['tables'][table]['columns'][col]
            
            # Normalizar tipos de datos (algunas diferencias son aceptables)
            local_type = str(local_col['type']).upper().replace('CHARACTER VARYING', 'VARCHAR')
            prod_type = str(prod_col['type']).upper().replace('CHARACTER VARYING', 'VARCHAR')
            
            if local_type != prod_type:
                # Verificar si es una diferencia significativa
                if not (('TIMESTAMP' in local_type and 'TIMESTAMP' in prod_type) or
                        ('NUMERIC' in local_type and 'NUMERIC' in prod_type) or
                        ('DECIMAL' in local_type and 'DECIMAL' in prod_type)):
                    differences.append(f"⚠️  Tabla '{table}', columna '{col}': tipo diferente - LOCAL: {local_type}, PROD: {prod_type}")
            
            if local_col['nullable'] != prod_col['nullable']:
                differences.append(f"⚠️  Tabla '{table}', columna '{col}': nullable diferente - LOCAL: {local_col['nullable']}, PROD: {prod_col['nullable']}")
        
        # Comparar Primary Keys
        local_pks = set(local_struct['tables'][table]['primary_keys'])
        prod_pks = set(prod_struct['tables'][table]['primary_keys'])
        
        if local_pks != prod_pks:
            differences.append(f"⚠️  Tabla '{table}': PKs diferentes - LOCAL: {local_pks}, PROD: {prod_pks}")
        
        # Comparar Foreign Keys
        local_fks = local_struct['tables'][table]['foreign_keys']
        prod_fks = prod_struct['tables'][table]['foreign_keys']
        
        if len(local_fks) != len(prod_fks):
            warnings.append(f"⚠️  Tabla '{table}': número de FKs diferente - LOCAL: {len(local_fks)}, PROD: {len(prod_fks)}")
    
    # Comparar índices
    for table in sorted(common_tables):
        local_indexes = {idx[0] for idx in local_struct['indexes'].get(table, [])}
        prod_indexes = {idx[0] for idx in prod_struct['indexes'].get(table, [])}
        
        missing_in_prod = local_indexes - prod_indexes
        missing_in_local = prod_indexes - local_indexes
        
        if missing_in_prod:
            warnings.append(f"ℹ️  Tabla '{table}': índices en LOCAL pero NO en PROD: {', '.join(sorted(missing_in_prod))}")
        
        if missing_in_local:
            warnings.append(f"ℹ️  Tabla '{table}': índices en PROD pero NO en LOCAL: {', '.join(sorted(missing_in_local))}")
    
    return differences, warnings

def main():
    print("=" * 80)
    print("🔍 COMPARACIÓN DE ESTRUCTURAS DE BASES DE DATOS")
    print("=" * 80)
    print()
    
    print("📊 Analizando base de datos LOCAL...")
    local_structure = get_database_structure(LOCAL_DB, "LOCAL")
    print(f"   ✅ {len(local_structure['tables'])} tablas encontradas")
    print()
    
    print("📊 Analizando base de datos PRODUCCIÓN (NEON)...")
    prod_structure = get_database_structure(PRODUCTION_DB, "PRODUCTION")
    print(f"   ✅ {len(prod_structure['tables'])} tablas encontradas")
    print()
    
    print("🔄 Comparando estructuras...")
    print()
    differences, warnings = compare_structures(local_structure, prod_structure)
    
    # Mostrar resultados
    print("=" * 80)
    print("📋 RESUMEN DE COMPARACIÓN")
    print("=" * 80)
    print()
    
    # Tablas
    local_tables = sorted(local_structure['tables'].keys())
    prod_tables = sorted(prod_structure['tables'].keys())
    common_tables = sorted(set(local_tables) & set(prod_tables))
    
    print(f"📊 Tablas:")
    print(f"   LOCAL: {len(local_tables)} tablas")
    print(f"   PRODUCCIÓN: {len(prod_tables)} tablas")
    print(f"   COMUNES: {len(common_tables)} tablas")
    print()
    
    # Diferencias críticas
    if differences:
        print("❌ DIFERENCIAS ENCONTRADAS:")
        print()
        for diff in differences:
            print(f"   {diff}")
        print()
    
    # Advertencias
    if warnings:
        print("⚠️  ADVERTENCIAS (no críticas):")
        print()
        for warn in warnings:
            print(f"   {warn}")
        print()
    
    # Resultado final
    print("=" * 80)
    if not differences and not warnings:
        print("✅ LAS ESTRUCTURAS SON IDÉNTICAS")
    elif differences:
        print(f"❌ SE ENCONTRARON {len(differences)} DIFERENCIAS CRÍTICAS")
        if warnings:
            print(f"⚠️  Y {len(warnings)} ADVERTENCIAS")
    else:
        print(f"⚠️  SE ENCONTRARON {len(warnings)} ADVERTENCIAS (pero sin diferencias críticas)")
    print("=" * 80)
    
    # Lista de tablas comunes para verificación
    if local_tables == prod_tables:
        print()
        print("📋 Tablas presentes en ambas bases:")
        for table in local_tables:
            col_count_local = len(local_structure['tables'][table]['columns'])
            col_count_prod = len(prod_structure['tables'][table]['columns'])
            status = "✅" if col_count_local == col_count_prod else "⚠️"
            print(f"   {status} {table}: {col_count_local} columnas (LOCAL) vs {col_count_prod} columnas (PROD)")

if __name__ == "__main__":
    main()
