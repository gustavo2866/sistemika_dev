"""
Script para cambiar el tipo de operación de propiedades
de Emprendimiento (id=3) a Venta (id=2) en PRODUCCIÓN (Neon)
"""
import os
from pathlib import Path
from dotenv import load_dotenv
from sqlalchemy import create_engine, text

# Cargar variables de entorno desde .env
env_path = Path(__file__).parent / ".env"
load_dotenv(env_path)

def get_production_database_url():
    """Obtener DATABASE_URL de producción (Neon) desde variables de entorno"""
    # URL de Neon desde el .env
    neon_url = "postgresql+psycopg://neondb_owner:npg_2HqUWwPRtEy7@ep-steep-bird-acyo7x0e-pooler.sa-east-1.aws.neon.tech/neondb?sslmode=require"
    
    print(f"✓ Usando URL de Neon: {neon_url[:50]}...")
    return neon_url

def update_propiedades_tipo_operacion():
    """Actualizar tipo de operación de Emprendimiento a Venta en producción"""
    print("\n" + "="*70)
    print("ACTUALIZANDO TIPO DE OPERACIÓN EN PRODUCCIÓN (NEON)")
    print("="*70)
    
    prod_db_url = get_production_database_url()
    if not prod_db_url:
        print("❌ No se pudo obtener la URL de producción")
        return
    
    print(f"\n✓ Conectando a base de datos de producción...")
    engine = create_engine(prod_db_url)
    
    try:
        with engine.connect() as conn:
            # Primero, verificar cuántas propiedades tienen tipo_operacion_id = 3
            result = conn.execute(text(
                "SELECT COUNT(*) FROM propiedades WHERE tipo_operacion_id = 3"
            ))
            count_emprendimiento = result.scalar()
            
            print(f"\n✓ Propiedades con tipo_operacion_id = 3 (Emprendimiento): {count_emprendimiento}")
            
            if count_emprendimiento == 0:
                print("\n✓ No hay propiedades para actualizar.")
                return
            
            # Mostrar algunas propiedades a actualizar
            result = conn.execute(text(
                "SELECT id, nombre FROM propiedades WHERE tipo_operacion_id = 3 LIMIT 10"
            ))
            propiedades_muestra = result.fetchall()
            
            print("\nMuestra de propiedades a actualizar:")
            for p in propiedades_muestra:
                print(f"  - ID: {p[0]}, Nombre: {p[1]}")
            
            if count_emprendimiento > 10:
                print(f"  ... y {count_emprendimiento - 10} más")
            
            # Confirmar antes de proceder
            print(f"\n⚠️  ADVERTENCIA: Estás a punto de actualizar {count_emprendimiento} propiedades en PRODUCCIÓN")
            confirmacion = input("¿Deseas continuar? (escribe 'SI' para confirmar): ")
            
            if confirmacion.strip().upper() != 'SI':
                print("\n❌ Operación cancelada por el usuario")
                return
            
            # Realizar la actualización
            result = conn.execute(text(
                "UPDATE propiedades SET tipo_operacion_id = 2 WHERE tipo_operacion_id = 3"
            ))
            conn.commit()
            
            rows_updated = result.rowcount
            print(f"\n✓ Se actualizaron {rows_updated} propiedades exitosamente")
            
            # Verificar el resultado
            result = conn.execute(text(
                "SELECT COUNT(*) FROM propiedades WHERE tipo_operacion_id = 2"
            ))
            count_venta = result.scalar()
            
            result = conn.execute(text(
                "SELECT COUNT(*) FROM propiedades WHERE tipo_operacion_id = 3"
            ))
            count_emprendimiento_final = result.scalar()
            
            print(f"\n✓ Verificación final:")
            print(f"  - Propiedades con tipo 'Venta' (id=2): {count_venta}")
            print(f"  - Propiedades con tipo 'Emprendimiento' (id=3): {count_emprendimiento_final}")
            
            if count_emprendimiento_final == 0:
                print("\n✅ ACTUALIZACIÓN COMPLETADA EXITOSAMENTE")
            else:
                print(f"\n⚠️  Advertencia: Aún quedan {count_emprendimiento_final} propiedades con tipo Emprendimiento")
                
    except Exception as e:
        print(f"\n❌ Error durante la actualización: {e}")
        raise
    finally:
        engine.dispose()

if __name__ == "__main__":
    update_propiedades_tipo_operacion()
