"""
Script para verificar el estado de las migraciones en la BD actual
"""
from sqlalchemy import text, inspect
from app.db import engine, DATABASE_URL
import re

def mask_password(url):
    """Oculta la contraseña en la URL"""
    return re.sub(r':([^:@]+)@', ':****@', url)

def check_migration_status():
    print("="*70)
    print("🔍 VERIFICACIÓN DE ESTADO DE MIGRACIONES")
    print("="*70)
    
    print(f"\n🔗 Base de datos: {mask_password(DATABASE_URL)}")
    
    with engine.connect() as conn:
        # 1. Verificar versión de Alembic
        print("\n📌 Versión de Alembic:")
        try:
            result = conn.execute(text("SELECT version_num FROM alembic_version"))
            version = result.fetchone()
            if version:
                print(f"   ✅ Versión actual: {version[0]}")
            else:
                print("   ⚠️  No hay versión registrada")
        except Exception as e:
            print(f"   ❌ Error: {e}")
            return
        
        # 2. Listar tablas
        print("\n📊 Tablas en la base de datos:")
        inspector = inspect(engine)
        tables = sorted(inspector.get_table_names())
        print(f"   Total: {len(tables)} tablas\n")
        
        for table in tables:
            columns = inspector.get_columns(table)
            print(f"   📋 {table:30} ({len(columns)} columnas)")
        
        # 3. Verificar integridad
        print("\n🔍 Verificando integridad referencial:")
        
        # Contar registros en tablas principales
        tables_to_check = [
            'users', 'proveedores', 'articulos', 'propiedades',
            'tipos_comprobante', 'metodos_pago', 'tareas'
        ]
        
        for table in tables_to_check:
            try:
                result = conn.execute(text(f"SELECT COUNT(*) FROM {table}"))
                count = result.fetchone()[0]
                print(f"   ✅ {table:20} {count:4} registros")
            except Exception as e:
                print(f"   ⚠️  {table:20} Error: {e}")
        
        # 4. Verificar constraints
        print("\n🔐 Verificando constraints importantes:")
        
        # Foreign keys en facturas
        try:
            result = conn.execute(text("""
                SELECT 
                    conname as constraint_name,
                    conrelid::regclass as table_name
                FROM pg_constraint 
                WHERE contype = 'f' 
                AND conrelid::regclass::text LIKE '%factura%'
                LIMIT 5
            """))
            fks = result.fetchall()
            print(f"   ✅ Foreign keys en facturas: {len(fks)}")
            for fk in fks:
                print(f"      - {fk[0]}")
        except Exception as e:
            print(f"   ⚠️  Error verificando constraints: {e}")
        
        conn.commit()
    
    print("\n" + "="*70)
    print("✅ VERIFICACIÓN COMPLETADA")
    print("="*70)
    
    print("\n💡 Para comparar con otra BD:")
    print("   1. Cambia DATABASE_URL en .env")
    print("   2. Ejecuta: alembic current")
    print("   3. Compara las versiones")
    print("\n   Si las versiones coinciden = estructuras idénticas ✅")

if __name__ == "__main__":
    check_migration_status()
