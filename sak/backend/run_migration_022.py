"""
Script para ejecutar la migración 022 de eventos.
IMPORTANTE: Hacer backup de la BD antes de ejecutar.
"""

import sys
from pathlib import Path

# Agregar el directorio backend al path
backend_dir = Path(__file__).parent
sys.path.insert(0, str(backend_dir))

print("=" * 70)
print("MIGRACIÓN 022: REFACTORIZACIÓN DE EVENTOS")
print("=" * 70)
print()
print("Esta migración realizará los siguientes cambios:")
print("  1. Agregar nuevas columnas: titulo, tipo_evento, resultado")
print("  2. Migrar datos existentes")
print("  3. Eliminar columnas antiguas: contacto_id, tipo_id, motivo_id, etc.")
print("  4. Crear índices nuevos")
print()
print("⚠️  IMPORTANTE: Esta migración es destructiva.")
print("   Asegúrate de tener un backup de la base de datos.")
print()

respuesta = input("¿Deseas continuar? (si/no): ").strip().lower()

if respuesta not in ['si', 's', 'yes', 'y']:
    print("Migración cancelada.")
    sys.exit(0)

print()
print("Ejecutando migración...")
print()

try:
    # Importar la función upgrade de la migración
    from migrations.migration_022_refactor_crm_eventos import upgrade
    
    # Importar la conexión
    from app.db import engine
    from sqlalchemy import text
    
    # Verificar estado actual
    print("Verificando estado actual de la tabla...")
    with engine.connect() as conn:
        result = conn.execute(text("""
            SELECT column_name 
            FROM information_schema.columns 
            WHERE table_name = 'crm_eventos' 
            AND column_name IN ('titulo', 'tipo_evento', 'resultado', 'contacto_id')
        """))
        columns = [row[0] for row in result]
        
        has_new = 'titulo' in columns or 'tipo_evento' in columns
        has_old = 'contacto_id' in columns
        
        print(f"  - Columnas nuevas presentes: {'SI' if has_new else 'NO'}")
        print(f"  - Columnas antiguas presentes: {'SI' if has_old else 'NO'}")
        print()
        
        if has_new and not has_old:
            print("✅ La migración ya fue ejecutada anteriormente.")
            sys.exit(0)
        
        if has_new and has_old:
            print("⚠️  Estado inconsistente: tiene columnas nuevas y antiguas.")
            print("   Posiblemente la migración se interrumpió.")
            print()
            continuar = input("¿Continuar de todos modos? (si/no): ").strip().lower()
            if continuar not in ['si', 's', 'yes', 'y']:
                sys.exit(1)
    
    # Ejecutar upgrade
    print("Ejecutando upgrade()...")
    print()
    upgrade()
    
    print()
    print("=" * 70)
    print("✅ MIGRACIÓN COMPLETADA EXITOSAMENTE")
    print("=" * 70)
    print()
    print("Próximo paso: Ejecutar script de validación")
    print("  python backend/scripts/validate_eventos_migration.py")
    
except Exception as e:
    print()
    print("=" * 70)
    print("❌ ERROR EN LA MIGRACIÓN")
    print("=" * 70)
    print(f"Error: {e}")
    print()
    import traceback
    traceback.print_exc()
    print()
    print("La migración falló. Revisar el error y posiblemente restaurar backup.")
    sys.exit(1)
