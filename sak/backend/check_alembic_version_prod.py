"""
Script para verificar la versión actual de Alembic en producción
"""
from sqlalchemy import create_engine, text

# URL de producción
PRODUCTION_DB = "postgresql+psycopg://neondb_owner:npg_2HqUWwPRtEy7@ep-steep-bird-acyo7x0e-pooler.sa-east-1.aws.neon.tech/neondb?sslmode=require"

def main():
    print("=" * 80)
    print("🔍 VERIFICAR VERSIÓN DE ALEMBIC EN PRODUCCIÓN")
    print("=" * 80)
    print()
    
    engine = create_engine(PRODUCTION_DB)
    
    try:
        with engine.connect() as conn:
            result = conn.execute(text("SELECT version_num FROM alembic_version;"))
            version = result.scalar()
            
            print(f"Versión actual en PRODUCCIÓN: {version}")
            print()
            
            # Información sobre la migración actual
            migrations_info = {
                "0001_initial_schema": "Initial schema using SQLModel metadata",
                "0002_seed_core_data": "Seed core catalog data",
                "0003_create_nomina": "Create nominas table",
                "0004_add_idproyecto_to_nominas": "Add idproyecto foreign key",
                "0005_create_parte_diario": "Create parte diario tables",
                "3b81b492a98d": "0020_create_departamentos",
                "c0a618facd27": "0021_create_tipos_solicitud",
                "b1d5f5c2279f": "0022_refactor_solicitudes",
                "90f5f68df0bf": "add_centro_costo_and_update_solicitudes",
                "623274e44549": "add_vacancia_and_update_propiedades",
                "2b6cc3ddf3d1": "convert_vacancia_dates_to_date (HEAD en desarrollo)"
            }
            
            if version in migrations_info:
                print(f"Descripción: {migrations_info[version]}")
            
            print()
            print("Versión esperada en DESARROLLO: 2b6cc3ddf3d1 (HEAD)")
            print()
            
            if version == "2b6cc3ddf3d1":
                print("✅ PRODUCCIÓN ESTÁ ACTUALIZADA - No hay migraciones pendientes")
            elif version == "623274e44549":
                print("⚠️  PRODUCCIÓN NECESITA MIGRACIÓN:")
                print("    - 2b6cc3ddf3d1: Convertir campos TIMESTAMP a DATE")
            else:
                print("⚠️  PRODUCCIÓN NECESITA MÚLTIPLES MIGRACIONES")
                print("    Ejecutar: alembic upgrade head")
            
    except Exception as e:
        print(f"❌ Error consultando versión: {e}")
        raise
    finally:
        engine.dispose()

if __name__ == "__main__":
    main()
