"""
Script para limpiar e importar datos en la base de datos
PASO 3: Limpieza de tablas propiedades y vacancias
PASO 4: Importación de datos validados de desarrollo
"""
import sys
import os

# Agregar el directorio backend al path
backend_path = os.path.join(os.path.dirname(__file__), '..', '..', '..', 'backend')
sys.path.insert(0, os.path.abspath(backend_path))

from app.db import engine
from sqlmodel import text
from datetime import datetime

def create_backup():
    """Crear backup de las tablas antes de limpiar"""
    print("\n📦 Creando backup de seguridad...")
    
    backup_timestamp = datetime.now().strftime('%Y%m%d_%H%M%S')
    
    with engine.connect() as conn:
        # Backup de propiedades
        conn.execute(text(f"""
            CREATE TABLE IF NOT EXISTS propiedades_backup_{backup_timestamp} AS 
            SELECT * FROM propiedades
        """))
        conn.commit()
        
        # Backup de vacancias
        conn.execute(text(f"""
            CREATE TABLE IF NOT EXISTS vacancias_backup_{backup_timestamp} AS 
            SELECT * FROM vacancias
        """))
        conn.commit()
        
        print(f"✓ Backup creado: propiedades_backup_{backup_timestamp}")
        print(f"✓ Backup creado: vacancias_backup_{backup_timestamp}")
    
    return backup_timestamp

def clean_tables():
    """Limpiar tablas propiedades y vacancias"""
    print("\n🗑️  Limpiando tablas...")
    
    with engine.connect() as conn:
        # Contar registros antes de limpiar
        result_prop = conn.execute(text("SELECT COUNT(*) FROM propiedades"))
        count_prop = result_prop.scalar()
        
        result_vac = conn.execute(text("SELECT COUNT(*) FROM vacancias"))
        count_vac = result_vac.scalar()
        
        print(f"   Propiedades actuales: {count_prop}")
        print(f"   Vacancias actuales: {count_vac}")
        
        # Eliminar foreign key de facturas temporalmente
        print("   🔓 Eliminando foreign key de facturas...")
        try:
            conn.execute(text("ALTER TABLE facturas DROP CONSTRAINT IF EXISTS facturas_propiedad_fk"))
            conn.commit()
            print("   ✓ Foreign key eliminada")
        except Exception as e:
            print(f"   ⚠️  No se pudo eliminar FK (puede que no exista): {str(e)[:100]}")
        
        # Limpiar vacancias primero (por FK)
        conn.execute(text("DELETE FROM vacancias"))
        conn.commit()
        print("   ✓ Vacancias eliminadas")
        
        # Limpiar propiedades
        conn.execute(text("DELETE FROM propiedades"))
        conn.commit()
        print("   ✓ Propiedades eliminadas")
        
        # Resetear secuencias
        conn.execute(text("ALTER SEQUENCE propiedades_id_seq RESTART WITH 1"))
        conn.execute(text("ALTER SEQUENCE vacancias_id_seq RESTART WITH 1"))
        conn.commit()
        print("   ✓ Secuencias reseteadas")
        
        # Verificar que quedaron vacías
        result_prop = conn.execute(text("SELECT COUNT(*) FROM propiedades"))
        result_vac = conn.execute(text("SELECT COUNT(*) FROM vacancias"))
        
        if result_prop.scalar() == 0 and result_vac.scalar() == 0:
            print("   ✓ Tablas limpiadas correctamente")
        else:
            raise Exception("❌ Error: Las tablas no quedaron vacías")

def restore_foreign_keys():
    """Restaurar foreign keys después de la importación"""
    print("\n🔒 Restaurando foreign keys...")
    
    with engine.connect() as conn:
        # Restaurar FK de facturas a propiedades
        try:
            conn.execute(text("""
                ALTER TABLE facturas 
                ADD CONSTRAINT facturas_propiedad_fk 
                FOREIGN KEY (propiedad_id) 
                REFERENCES propiedades(id)
            """))
            conn.commit()
            print("   ✓ Foreign key de facturas restaurada")
        except Exception as e:
            print(f"   ⚠️  Error al restaurar FK: {str(e)[:200]}")

def import_data(sql_file: str, table_name: str):
    """Importar datos desde archivo SQL"""
    print(f"\n📥 Importando {table_name}...")
    
    if not os.path.exists(sql_file):
        raise FileNotFoundError(f"❌ No se encontró el archivo: {sql_file}")
    
    with open(sql_file, 'r', encoding='utf-8') as f:
        sql_content = f.read()
    
    # Separar por statements (líneas que terminan con ;)
    statements = [s.strip() for s in sql_content.split(';') if s.strip() and not s.strip().startswith('--')]
    
    print(f"   Total de INSERT statements: {len(statements)}")
    
    with engine.connect() as conn:
        for i, statement in enumerate(statements, 1):
            if statement:
                try:
                    conn.execute(text(statement))
                except Exception as e:
                    print(f"   ❌ Error en statement {i}: {str(e)[:100]}")
                    raise
        
        conn.commit()
        
        # Verificar importación
        result = conn.execute(text(f"SELECT COUNT(*) FROM {table_name}"))
        count = result.scalar()
        print(f"   ✓ Importados {count} registros")
    
    return count

def update_sequences():
    """Actualizar secuencias después de importación"""
    print("\n🔄 Actualizando secuencias...")
    
    with engine.connect() as conn:
        # Actualizar secuencia de propiedades
        conn.execute(text("SELECT setval('propiedades_id_seq', (SELECT COALESCE(MAX(id), 1) FROM propiedades))"))
        result_prop = conn.execute(text("SELECT last_value FROM propiedades_id_seq"))
        seq_prop = result_prop.scalar()
        print(f"   ✓ propiedades_id_seq: {seq_prop}")
        
        # Actualizar secuencia de vacancias
        conn.execute(text("SELECT setval('vacancias_id_seq', (SELECT COALESCE(MAX(id), 1) FROM vacancias))"))
        result_vac = conn.execute(text("SELECT last_value FROM vacancias_id_seq"))
        seq_vac = result_vac.scalar()
        print(f"   ✓ vacancias_id_seq: {seq_vac}")
        
        conn.commit()

def verify_data():
    """Verificar integridad de datos importados (Paso 5)"""
    print("\n✅ PASO 5: Verificación de Datos Importados")
    print("="*60)
    
    with engine.connect() as conn:
        # 5.1 Verificar integridad referencial
        print("\n5.1 Verificando integridad referencial...")
        
        result = conn.execute(text("""
            SELECT COUNT(*) as vacancias_huerfanas
            FROM vacancias v
            LEFT JOIN propiedades p ON v.propiedad_id = p.id
            WHERE p.id IS NULL
        """))
        huerfanas = result.scalar()
        print(f"   Vacancias sin propiedad: {huerfanas}")
        if huerfanas > 0:
            print("   ⚠️  ADVERTENCIA: Hay vacancias sin propiedad asociada")
        else:
            print("   ✓ Todas las vacancias tienen propiedad válida")
        
        # Vacancias activas
        result = conn.execute(text("""
            SELECT COUNT(*) as vacancias_activas
            FROM vacancias
            WHERE ciclo_activo = true AND deleted_at IS NULL
        """))
        activas = result.scalar()
        print(f"   Vacancias activas: {activas}")
        
        # Distribución de estados
        print("\n   Distribución de estados de propiedades:")
        result = conn.execute(text("""
            SELECT estado, COUNT(*) as cantidad
            FROM propiedades
            WHERE deleted_at IS NULL
            GROUP BY estado
            ORDER BY estado
        """))
        for row in result:
            print(f"      {row.estado}: {row.cantidad}")
        
        # Propiedades sin estado_fecha
        result = conn.execute(text("""
            SELECT COUNT(*) as sin_estado_fecha
            FROM propiedades
            WHERE estado_fecha IS NULL AND deleted_at IS NULL
        """))
        sin_fecha = result.scalar()
        print(f"\n   Propiedades sin estado_fecha: {sin_fecha}")
        if sin_fecha > 0:
            print("   ⚠️  Hay propiedades sin estado_fecha")
        else:
            print("   ✓ Todas las propiedades tienen estado_fecha")
        
        # 5.2 Verificar datos críticos
        print("\n5.2 Verificando datos críticos...")
        
        result = conn.execute(text("""
            SELECT 
                p.id,
                p.nombre,
                p.propietario,
                p.estado,
                p.estado_fecha,
                COUNT(v.id) as total_vacancias,
                SUM(CASE WHEN v.ciclo_activo THEN 1 ELSE 0 END) as vacancias_activas
            FROM propiedades p
            LEFT JOIN vacancias v ON p.id = v.propiedad_id
            WHERE p.deleted_at IS NULL
            GROUP BY p.id, p.nombre, p.propietario, p.estado, p.estado_fecha
            ORDER BY p.id
            LIMIT 5
        """))
        
        print("   Primeras 5 propiedades:")
        for row in result:
            fecha = row.estado_fecha.strftime('%Y-%m-%d %H:%M') if row.estado_fecha else 'N/A'
            print(f"      ID {row.id}: {row.nombre} | {row.estado} | Fecha: {fecha} | Vacancias: {row.total_vacancias} (activas: {row.vacancias_activas})")
        
        # Verificar fechas de vacancias
        print("\n   Vacancias con ciclo activo (primeras 5):")
        result = conn.execute(text("""
            SELECT 
                v.id,
                v.propiedad_id,
                p.nombre as propiedad,
                v.fecha_recibida,
                v.fecha_en_reparacion,
                v.fecha_disponible,
                v.fecha_alquilada,
                v.fecha_retirada
            FROM vacancias v
            JOIN propiedades p ON v.propiedad_id = p.id
            WHERE v.ciclo_activo = true AND v.deleted_at IS NULL
            ORDER BY v.id
            LIMIT 5
        """))
        
        for row in result:
            print(f"      Vacancia ID {row.id} - Propiedad: {row.propiedad}")
            if row.fecha_recibida:
                print(f"         Recibida: {row.fecha_recibida.strftime('%Y-%m-%d %H:%M')}")
            if row.fecha_en_reparacion:
                print(f"         En reparación: {row.fecha_en_reparacion.strftime('%Y-%m-%d %H:%M')}")
            if row.fecha_disponible:
                print(f"         Disponible: {row.fecha_disponible.strftime('%Y-%m-%d %H:%M')}")
            if row.fecha_alquilada:
                print(f"         Alquilada: {row.fecha_alquilada.strftime('%Y-%m-%d %H:%M')}")

def main():
    print("="*60)
    print("DEPLOY DE PROPIEDADES Y VACANCIAS")
    print("Pasos 3, 4 y 5: Limpieza, Importación y Verificación")
    print("="*60)
    
    try:
        # Paso 3.1: Crear backup
        backup_timestamp = create_backup()
        
        # Paso 3.2: Limpiar tablas
        clean_tables()
        
        # Paso 4: Importar datos
        script_dir = os.path.dirname(os.path.abspath(__file__))
        
        # Importar propiedades
        prop_file = os.path.join(script_dir, '..', '..', '..', 'backend', 'propiedades_dev_data.sql')
        count_prop = import_data(prop_file, 'propiedades')
        
        # Importar vacancias
        vac_file = os.path.join(script_dir, '..', '..', '..', 'backend', 'vacancias_dev_data.sql')
        count_vac = import_data(vac_file, 'vacancias')
        
        # Paso 4.4: Actualizar secuencias
        update_sequences()
        
        # Restaurar foreign keys
        restore_foreign_keys()
        
        # Paso 5: Verificación
        verify_data()
        
        print("\n" + "="*60)
        print("✅ DEPLOY COMPLETADO EXITOSAMENTE")
        print("="*60)
        print(f"\nResumen:")
        print(f"  - Propiedades importadas: {count_prop}")
        print(f"  - Vacancias importadas: {count_vac}")
        print(f"  - Backup disponible: *_backup_{backup_timestamp}")
        print("\n⚠️  SIGUIENTE PASO: Desplegar código del backend y frontend")
        
    except Exception as e:
        print("\n" + "="*60)
        print("❌ ERROR EN EL DEPLOY")
        print("="*60)
        print(f"\nError: {str(e)}")
        print("\n⚠️  ROLLBACK RECOMENDADO:")
        print(f"   Restaurar desde tablas de backup: *_backup_{backup_timestamp if 'backup_timestamp' in locals() else 'TIMESTAMP'}")
        raise

if __name__ == "__main__":
    # Confirmación antes de ejecutar
    print("\n⚠️  ADVERTENCIA: Este script va a:")
    print("   1. Crear backup de propiedades y vacancias")
    print("   2. ELIMINAR todos los datos de propiedades y vacancias")
    print("   3. Importar datos de desarrollo validados")
    print("   4. Verificar integridad de datos")
    print("\n¿Deseas continuar? (escribe 'SI' para confirmar)")
    
    confirmacion = input("> ").strip()
    if confirmacion.upper() == 'SI':
        main()
    else:
        print("\n❌ Operación cancelada por el usuario")
