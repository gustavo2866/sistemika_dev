#!/usr/bin/env python3
"""Verificar coincidencia entre modelos SQLModel y tablas de base de datos."""

import sys
import os
from typing import Dict, List, Any, Set

# Agregar el directorio actual al path
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

from sqlalchemy import inspect, MetaData
from sqlmodel import SQLModel
from app.core.database import engine

# Importar todos los modelos
from app.models import *

def get_model_tables() -> Dict[str, Any]:
    """Obtener todas las tablas definidas en los modelos SQLModel."""
    model_tables = {}
    
    # Obtener metadata de SQLModel
    metadata = SQLModel.metadata
    
    for table_name, table in metadata.tables.items():
        model_tables[table_name] = table
    
    return model_tables

def get_db_tables() -> Dict[str, Any]:
    """Obtener todas las tablas existentes en la base de datos."""
    inspector = inspect(engine)
    db_tables = {}
    
    for table_name in inspector.get_table_names():
        db_tables[table_name] = {
            'columns': {col['name']: col for col in inspector.get_columns(table_name)},
            'indexes': inspector.get_indexes(table_name),
            'foreign_keys': inspector.get_foreign_keys(table_name),
            'unique_constraints': inspector.get_unique_constraints(table_name)
        }
    
    return db_tables

def compare_columns(model_table, db_table_info) -> List[str]:
    """Comparar columnas entre modelo y base de datos."""
    differences = []
    
    # Columnas del modelo
    model_columns = {col.name: col for col in model_table.columns}
    
    # Columnas de la BD
    db_columns = db_table_info['columns']
    
    # Verificar columnas faltantes en BD
    for col_name, col in model_columns.items():
        if col_name not in db_columns:
            differences.append(f"❌ Columna '{col_name}' existe en modelo pero NO en BD")
        else:
            # Verificar tipos (simplificado)
            db_col = db_columns[col_name]
            model_nullable = col.nullable if hasattr(col, 'nullable') else True
            db_nullable = db_col['nullable']
            
            if model_nullable != db_nullable:
                differences.append(f"⚠️  Columna '{col_name}': nullable={model_nullable} en modelo, nullable={db_nullable} en BD")
    
    # Verificar columnas extra en BD
    for col_name in db_columns:
        if col_name not in model_columns:
            differences.append(f"🔍 Columna '{col_name}' existe en BD pero NO en modelo")
    
    return differences

def compare_foreign_keys(model_table, db_table_info) -> List[str]:
    """Comparar foreign keys."""
    differences = []
    
    # FK del modelo
    model_fks = set()
    for col in model_table.columns:
        if col.foreign_keys:
            for fk in col.foreign_keys:
                model_fks.add(f"{col.name} -> {fk.column}")
    
    # FK de la BD  
    db_fks = set()
    for fk in db_table_info['foreign_keys']:
        constrained_cols = ','.join(fk['constrained_columns'])
        referred_table = fk['referred_table']
        referred_cols = ','.join(fk['referred_columns'])
        db_fks.add(f"{constrained_cols} -> {referred_table}.{referred_cols}")
    
    # Comparar
    missing_in_db = model_fks - db_fks
    extra_in_db = db_fks - model_fks
    
    for fk in missing_in_db:
        differences.append(f"❌ FK '{fk}' existe en modelo pero NO en BD")
    
    for fk in extra_in_db:
        differences.append(f"🔍 FK '{fk}' existe en BD pero NO en modelo")
    
    return differences

def main():
    print("🔍 VERIFICANDO COINCIDENCIA ENTRE MODELOS Y BASE DE DATOS")
    print("=" * 70)
    
    try:
        # Obtener tablas de modelos y BD
        model_tables = get_model_tables()
        db_tables = get_db_tables()
        
        print(f"\n📊 RESUMEN GENERAL:")
        print(f"   Tablas en modelos: {len(model_tables)}")
        print(f"   Tablas en BD: {len(db_tables)}")
        
        # Verificar tablas faltantes o sobrantes
        model_table_names = set(model_tables.keys())
        db_table_names = set(db_tables.keys())
        
        missing_in_db = model_table_names - db_table_names
        extra_in_db = db_table_names - model_table_names
        
        if missing_in_db:
            print(f"\n❌ TABLAS FALTANTES EN BD ({len(missing_in_db)}):")
            for table in sorted(missing_in_db):
                print(f"   • {table}")
        
        if extra_in_db:
            print(f"\n🔍 TABLAS EXTRA EN BD ({len(extra_in_db)}):")
            for table in sorted(extra_in_db):
                print(f"   • {table}")
        
        # Verificar tablas comunes
        common_tables = model_table_names & db_table_names
        
        print(f"\n🔄 VERIFICANDO TABLAS COMUNES ({len(common_tables)}):")
        print("-" * 50)
        
        total_differences = 0
        tables_with_issues = 0
        
        for table_name in sorted(common_tables):
            model_table = model_tables[table_name]
            db_table_info = db_tables[table_name]
            
            # Comparar columnas
            column_diffs = compare_columns(model_table, db_table_info)
            
            # Comparar foreign keys
            fk_diffs = compare_foreign_keys(model_table, db_table_info)
            
            all_diffs = column_diffs + fk_diffs
            
            if all_diffs:
                tables_with_issues += 1
                total_differences += len(all_diffs)
                
                print(f"\n⚠️  TABLA: {table_name} ({len(all_diffs)} diferencias)")
                for diff in all_diffs[:5]:  # Mostrar máximo 5 diferencias por tabla
                    print(f"      {diff}")
                
                if len(all_diffs) > 5:
                    print(f"      ... y {len(all_diffs) - 5} diferencias más")
            else:
                print(f"✅ {table_name}")
        
        # Resumen final
        print("\n" + "=" * 70)
        print(f"📈 RESUMEN FINAL:")
        print(f"   Tablas verificadas: {len(common_tables)}")
        print(f"   Tablas con diferencias: {tables_with_issues}")
        print(f"   Total diferencias encontradas: {total_differences}")
        print(f"   Tablas faltantes en BD: {len(missing_in_db)}")
        print(f"   Tablas extra en BD: {len(extra_in_db)}")
        
        if total_differences == 0 and len(missing_in_db) == 0:
            print("\n🎉 ¡MODELOS Y BASE DE DATOS ESTÁN SINCRONIZADOS!")
        else:
            print(f"\n⚠️  SE ENCONTRARON INCONSISTENCIAS - Revisar migración necesaria")
            
        # Recomendaciones
        print(f"\n💡 RECOMENDACIONES:")
        if total_differences > 20:
            print("   🚨 Muchas diferencias detectadas - La migración contiene cambios reales")
        elif total_differences > 0:
            print("   ⚠️  Algunas diferencias menores - Revisar si son críticas")
        else:
            print("   ✅ Sin diferencias críticas - La migración puede contener falsos positivos")
        
        if missing_in_db:
            print("   📝 Hay tablas nuevas que se crearán")
        if extra_in_db and 'backup' in str(extra_in_db):
            print("   🗑️  Hay tablas backup que se pueden eliminar")
            
    except Exception as e:
        print(f"❌ ERROR durante la verificación: {e}")
        import traceback
        traceback.print_exc()

if __name__ == "__main__":
    main()