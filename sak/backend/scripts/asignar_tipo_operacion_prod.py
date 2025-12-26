"""
Script para asignar tipo de operación a propiedades según su estado en PRODUCCIÓN (Neon)
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
    neon_url = "postgresql+psycopg://neondb_owner:npg_2HqUWwPRtEy7@ep-steep-bird-acyo7x0e-pooler.sa-east-1.aws.neon.tech/neondb?sslmode=require"
    return neon_url

def analizar_propiedades():
    """Analizar propiedades sin tipo de operación asignado"""
    print("\n" + "="*70)
    print("ANALIZANDO PROPIEDADES EN PRODUCCIÓN (NEON)")
    print("="*70)
    
    prod_db_url = get_production_database_url()
    if not prod_db_url:
        print("❌ No se pudo obtener la URL de producción")
        return
    
    print(f"\n✓ Conectando a base de datos de producción...")
    engine = create_engine(prod_db_url)
    
    try:
        with engine.connect() as conn:
            # Verificar tipos de operación disponibles
            print("\n📋 Tipos de operación disponibles:")
            result = conn.execute(text(
                "SELECT id, nombre, codigo FROM crm_tipos_operacion ORDER BY id"
            ))
            tipos_operacion = result.fetchall()
            for tipo in tipos_operacion:
                print(f"  ID: {tipo[0]}, Nombre: {tipo[1]}, Código: {tipo[2]}")
            
            # Total de propiedades
            result = conn.execute(text("SELECT COUNT(*) FROM propiedades"))
            total_propiedades = result.scalar()
            print(f"\n📊 Total de propiedades: {total_propiedades}")
            
            # Propiedades sin tipo_operacion_id
            result = conn.execute(text(
                "SELECT COUNT(*) FROM propiedades WHERE tipo_operacion_id IS NULL"
            ))
            sin_tipo = result.scalar()
            print(f"⚠️  Propiedades sin tipo_operacion_id: {sin_tipo}")
            
            # Propiedades con tipo_operacion_id
            result = conn.execute(text(
                "SELECT COUNT(*) FROM propiedades WHERE tipo_operacion_id IS NOT NULL"
            ))
            con_tipo = result.scalar()
            print(f"✓ Propiedades con tipo_operacion_id: {con_tipo}")
            
            # Distribución por estado
            print("\n📊 Distribución de propiedades sin tipo_operacion_id por estado:")
            result = conn.execute(text("""
                SELECT estado, COUNT(*) as cantidad
                FROM propiedades 
                WHERE tipo_operacion_id IS NULL
                GROUP BY estado
                ORDER BY cantidad DESC
            """))
            estados = result.fetchall()
            
            if not estados:
                print("  ✓ Todas las propiedades tienen tipo_operacion_id asignado")
                return
            
            for estado in estados:
                print(f"  - Estado: {estado[0]}, Cantidad: {estado[1]}")
            
            # Mostrar muestra de propiedades sin tipo
            print("\n📋 Muestra de propiedades sin tipo_operacion_id:")
            result = conn.execute(text("""
                SELECT id, nombre, estado, propietario
                FROM propiedades 
                WHERE tipo_operacion_id IS NULL
                LIMIT 10
            """))
            propiedades = result.fetchall()
            for p in propiedades:
                print(f"  ID: {p[0]}, Nombre: {p[1]}, Estado: {p[2]}, Propietario: {p[3]}")
            
            if sin_tipo > 10:
                print(f"  ... y {sin_tipo - 10} más")
            
            # Proponer asignación según estado
            print("\n💡 PROPUESTA DE ASIGNACIÓN:")
            print("  - Estados '4-realizada' → Tipo 'Alquiler' (ID: 1)")
            print("  - Otros estados → Tipo 'Venta' (ID: 2)")
            
            confirmacion = input("\n¿Deseas aplicar esta asignación? (escribe 'SI' para confirmar): ")
            
            if confirmacion.strip().upper() != 'SI':
                print("\n❌ Operación cancelada por el usuario")
                return
            
            # Actualizar propiedades alquiladas
            result = conn.execute(text("""
                UPDATE propiedades 
                SET tipo_operacion_id = 1 
                WHERE tipo_operacion_id IS NULL 
                AND estado = '4-realizada'
            """))
            alquiladas_actualizadas = result.rowcount
            
            # Actualizar el resto a Venta
            result = conn.execute(text("""
                UPDATE propiedades 
                SET tipo_operacion_id = 2 
                WHERE tipo_operacion_id IS NULL
            """))
            otras_actualizadas = result.rowcount
            
            conn.commit()
            
            print(f"\n✅ ACTUALIZACIÓN COMPLETADA:")
            print(f"  - Propiedades asignadas a 'Alquiler': {alquiladas_actualizadas}")
            print(f"  - Propiedades asignadas a 'Venta': {otras_actualizadas}")
            print(f"  - Total actualizado: {alquiladas_actualizadas + otras_actualizadas}")
            
            # Verificación final
            result = conn.execute(text(
                "SELECT COUNT(*) FROM propiedades WHERE tipo_operacion_id IS NULL"
            ))
            sin_tipo_final = result.scalar()
            
            if sin_tipo_final == 0:
                print("\n✅ Todas las propiedades tienen tipo_operacion_id asignado")
            else:
                print(f"\n⚠️  Advertencia: Aún quedan {sin_tipo_final} propiedades sin tipo_operacion_id")
                
    except Exception as e:
        print(f"\n❌ Error durante el análisis/actualización: {e}")
        raise
    finally:
        engine.dispose()

if __name__ == "__main__":
    analizar_propiedades()
