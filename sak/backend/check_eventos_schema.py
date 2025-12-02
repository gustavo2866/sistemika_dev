"""
Script para verificar el esquema actual de la tabla crm_eventos
"""
from sqlalchemy import inspect
from app.db import engine


def check_eventos_schema():
    inspector = inspect(engine)
    
    # Obtener columnas de crm_eventos
    columns = inspector.get_columns('crm_eventos')
    
    print("\n" + "="*80)
    print("ESQUEMA ACTUAL DE LA TABLA crm_eventos")
    print("="*80)
    print(f"Total de columnas: {len(columns)}\n")
    
    print(f"{'Columna':<30} {'Tipo':<25} {'Nullable':<10} {'Default'}")
    print("-"*80)
    
    for col in columns:
        col_name = col['name']
        col_type = str(col['type'])
        nullable = "YES" if col['nullable'] else "NO"
        default = str(col.get('default', ''))
        print(f"{col_name:<30} {col_type:<25} {nullable:<10} {default}")
    
    print("\n" + "="*80)
    print("VERIFICACIÓN DE COLUMNAS NUEVAS DEL MODELO REFACTORIZADO")
    print("="*80)
    
    column_names = [col['name'] for col in columns]
    
    # Columnas que DEBEN existir después de la migración
    nuevas_columnas = ['titulo', 'tipo_evento', 'resultado']
    
    # Columnas que DEBEN eliminarse después de la migración
    columnas_viejas = ['contacto_id', 'tipo_id', 'motivo_id', 'origen_lead_id', 
                       'proximo_paso', 'fecha_compromiso']
    
    print("\n✓ Columnas nuevas (deben existir):")
    for col in nuevas_columnas:
        existe = col in column_names
        status = "✅ EXISTE" if existe else "❌ NO EXISTE"
        print(f"  - {col:<25} {status}")
    
    print("\n✗ Columnas viejas (deben eliminarse):")
    for col in columnas_viejas:
        existe = col in column_names
        status = "❌ AÚN EXISTE" if existe else "✅ ELIMINADA"
        print(f"  - {col:<25} {status}")
    
    print("\n" + "="*80)
    
    # Determinar si la migración se ejecutó
    migration_executed = all(col in column_names for col in nuevas_columnas) and \
                        not any(col in column_names for col in columnas_viejas)
    
    if migration_executed:
        print("✅ MIGRACIÓN EJECUTADA - El esquema está actualizado")
    else:
        print("⚠️  MIGRACIÓN PENDIENTE - El esquema necesita actualizarse")
        print("\nPara ejecutar la migración, ejecuta:")
        print("  python run_migration_022.py")
    
    print("="*80 + "\n")


if __name__ == "__main__":
    check_eventos_schema()
