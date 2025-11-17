"""
Script para crear backup de tablas afectadas en producción antes de aplicar migraciones.
Crea tablas de backup: propiedades_backup_prod_20251117 y vacancias_backup_prod_20251117
"""
from sqlalchemy import create_engine, text
from datetime import datetime

# URL de producción
PRODUCTION_DB = "postgresql+psycopg://neondb_owner:npg_2HqUWwPRtEy7@ep-steep-bird-acyo7x0e-pooler.sa-east-1.aws.neon.tech/neondb?sslmode=require"

def create_table_backup(engine, table_name, backup_suffix="prod_20251117"):
    """Crea una tabla de backup copiando todos los datos."""
    backup_table = f"{table_name}_backup_{backup_suffix}"
    
    with engine.connect() as conn:
        # Verificar si ya existe el backup
        result = conn.execute(text(f"""
            SELECT EXISTS (
                SELECT FROM information_schema.tables 
                WHERE table_name = '{backup_table}'
            );
        """))
        exists = result.scalar()
        
        if exists:
            print(f"⚠️  El backup {backup_table} ya existe. Eliminándolo...")
            conn.execute(text(f"DROP TABLE {backup_table};"))
            conn.commit()
        
        # Crear backup
        print(f"📦 Creando backup: {backup_table}...")
        conn.execute(text(f"""
            CREATE TABLE {backup_table} AS 
            SELECT * FROM {table_name};
        """))
        conn.commit()
        
        # Contar registros
        result = conn.execute(text(f"SELECT COUNT(*) FROM {backup_table};"))
        count = result.scalar()
        print(f"✅ Backup creado: {backup_table} ({count} registros)")
        
        return backup_table, count

def main():
    print("=" * 80)
    print("🔒 BACKUP DE TABLAS AFECTADAS - PRODUCCIÓN")
    print("=" * 80)
    print()
    print(f"Fecha: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}")
    print(f"Destino: Base de datos de producción (Neon)")
    print()
    
    engine = create_engine(PRODUCTION_DB)
    
    try:
        # Backup de propiedades
        prop_backup, prop_count = create_table_backup(engine, "propiedades")
        print()
        
        # Backup de vacancias
        vac_backup, vac_count = create_table_backup(engine, "vacancias")
        print()
        
        print("=" * 80)
        print("✅ BACKUP COMPLETADO EXITOSAMENTE")
        print("=" * 80)
        print()
        print(f"Tablas respaldadas:")
        print(f"  - {prop_backup}: {prop_count} registros")
        print(f"  - {vac_backup}: {vac_count} registros")
        print()
        print("Para restaurar en caso de problemas:")
        print(f"  DROP TABLE propiedades;")
        print(f"  ALTER TABLE {prop_backup} RENAME TO propiedades;")
        print(f"  DROP TABLE vacancias;")
        print(f"  ALTER TABLE {vac_backup} RENAME TO vacancias;")
        print()
        
    except Exception as e:
        print(f"❌ Error creando backup: {e}")
        raise
    finally:
        engine.dispose()

if __name__ == "__main__":
    main()
