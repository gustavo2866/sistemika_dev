"""
Script para exportar datos de propiedades y vacancias de desarrollo
Genera archivos SQL con INSERT statements
"""
import sys
import os

# Agregar el directorio backend al path para poder importar módulos
backend_path = os.path.join(os.path.dirname(__file__), '..', '..', '..', 'backend')
sys.path.insert(0, os.path.abspath(backend_path))

from app.db import engine
from sqlmodel import text
import json
from datetime import datetime

def export_table_to_sql(table_name: str, output_file: str):
    """Exporta una tabla a archivo SQL con INSERT statements"""
    print(f"\n📦 Exportando tabla {table_name}...")
    
    with engine.connect() as conn:
        # Obtener todos los registros activos
        result = conn.execute(text(f"SELECT * FROM {table_name} WHERE deleted_at IS NULL ORDER BY id"))
        rows = result.fetchall()
        columns = result.keys()
        
        if not rows:
            print(f"⚠️  No hay datos en {table_name}")
            return
        
        # Crear archivo SQL
        with open(output_file, 'w', encoding='utf-8') as f:
            f.write(f"-- Datos de {table_name} exportados desde desarrollo\n")
            f.write(f"-- Fecha: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}\n")
            f.write(f"-- Total de registros: {len(rows)}\n\n")
            
            for row in rows:
                # Construir INSERT statement
                col_names = ', '.join(columns)
                values = []
                
                for col, val in zip(columns, row):
                    if val is None:
                        values.append('NULL')
                    elif isinstance(val, (int, float, bool)):
                        values.append(str(val))
                    elif isinstance(val, datetime):
                        values.append(f"'{val.isoformat()}'")
                    else:
                        # Escapar comillas simples
                        val_str = str(val).replace("'", "''")
                        values.append(f"'{val_str}'")
                
                values_str = ', '.join(values)
                f.write(f"INSERT INTO {table_name} ({col_names}) VALUES ({values_str});\n")
        
        print(f"✓ Exportados {len(rows)} registros a {output_file}")

def main():
    print("="*60)
    print("EXPORTACIÓN DE DATOS DE DESARROLLO")
    print("="*60)
    
    # Exportar propiedades
    export_table_to_sql('propiedades', 'propiedades_dev_data.sql')
    
    # Exportar vacancias
    export_table_to_sql('vacancias', 'vacancias_dev_data.sql')
    
    print("\n" + "="*60)
    print("✅ EXPORTACIÓN COMPLETADA")
    print("="*60)
    print("\nArchivos generados:")
    print("  - propiedades_dev_data.sql")
    print("  - vacancias_dev_data.sql")
    print("\n⚠️  IMPORTANTE: Estos archivos contienen datos de producción")
    print("   Revisa los archivos antes de importarlos a producción")

if __name__ == "__main__":
    main()
