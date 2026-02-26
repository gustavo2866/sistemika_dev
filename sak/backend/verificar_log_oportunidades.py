"""
Verificar consistencia de la tabla crm_oportunidad_log_estado
"""
import os
import sys
from sqlalchemy import create_engine, text
from sqlalchemy.orm import sessionmaker

def get_database_url():
    """Obtener URL de la base de datos desde variables de entorno."""
    # Para desarrollo local
    if os.getenv("DATABASE_URL"):
        return os.getenv("DATABASE_URL")
    else:
        # URL por defecto para desarrollo local
        return "postgresql://postgres:1234@localhost:5432/sistemika_dev"

def verificar_tabla_log_estado():
    """Verificar estado de la tabla crm_oportunidad_log_estado"""
    
    # Configurar conexión a BD
    database_url = get_database_url()
    engine = create_engine(database_url)
    SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)
    session = SessionLocal()
    
    try:
        print("=== VERIFICACIÓN TABLA crm_oportunidad_log_estado ===\n")
        
        # 1. Verificar si la tabla existe
        print("1. Verificando si la tabla existe...")
        try:
            result = session.execute(text("SELECT 1 FROM crm_oportunidad_log_estado LIMIT 1"))
            print("   ✅ La tabla existe")
        except Exception as e:
            print(f"   ❌ Error al acceder a la tabla: {e}")
            print("   💡 La tabla probablemente no existe en la base de datos")
            return
        
        # 2. Contar registros en log
        total_logs = session.execute(text("SELECT COUNT(*) FROM crm_oportunidad_log_estado")).scalar()
        print(f"   📊 Total registros en log: {total_logs}")
        
        # 3. Contar oportunidades
        total_oportunidades = session.execute(text("SELECT COUNT(*) FROM crm_oportunidades")).scalar()
        print(f"   📊 Total oportunidades: {total_oportunidades}")
        
        if total_logs == 0:
            print("   ⚠️  La tabla está vacía - no hay logs de estado")
            if total_oportunidades > 0:
                print("   💡 Hay oportunidades pero ningún log - tabla no poblada")
            return
            
        print("\n2. Análisis de consistencia...")
        
        # 4. Verificar oportunidades sin logs
        oportunidades_sin_logs = session.execute(text("""
            SELECT COUNT(*) as count 
            FROM crm_oportunidades o 
            WHERE o.id NOT IN (
                SELECT DISTINCT oportunidad_id 
                FROM crm_oportunidad_log_estado
            )
        """)).scalar()
        
        print(f"   📊 Oportunidades sin logs: {oportunidades_sin_logs}")
        
        # 5. Verificar estado actual vs último log
        inconsistencias = session.execute(text("""
            WITH ultimo_log AS (
                SELECT DISTINCT ON (oportunidad_id) 
                    oportunidad_id,
                    estado_nuevo as ultimo_estado_log
                FROM crm_oportunidad_log_estado 
                ORDER BY oportunidad_id, fecha_registro DESC
            )
            SELECT COUNT(*) as count
            FROM crm_oportunidades o
            JOIN ultimo_log ul ON o.id = ul.oportunidad_id
            WHERE o.estado != ul.ultimo_estado_log
        """)).scalar()
        
        print(f"   📊 Inconsistencias estado actual vs log: {inconsistencias}")
        
        # 6. Mostrar algunos ejemplos de logs
        print("\n3. Últimos 5 logs registrados:")
        ultimos_logs = session.execute(text("""
            SELECT 
                l.oportunidad_id,
                l.estado_anterior,
                l.estado_nuevo,
                l.fecha_registro,
                o.estado as estado_actual
            FROM crm_oportunidad_log_estado l
            JOIN crm_oportunidades o ON l.oportunidad_id = o.id
            ORDER BY l.fecha_registro DESC
            LIMIT 5
        """)).fetchall()
        
        for log in ultimos_logs:
            print(f"   Oportunidad {log[0]}: {log[1]} → {log[2]} ({log[3]}) [Actual: {log[4]}]")
        
        # 7. Estados más comunes en logs
        print("\n4. Estados más registrados en logs:")
        estados_comunes = session.execute(text("""
            SELECT estado_nuevo, COUNT(*) as cantidad
            FROM crm_oportunidad_log_estado
            GROUP BY estado_nuevo
            ORDER BY cantidad DESC
            LIMIT 5
        """)).fetchall()
        
        for estado, cantidad in estados_comunes:
            print(f"   {estado}: {cantidad} registros")
            
        # 8. Verificar fechas sospechosas
        print("\n5. Verificando fechas...")
        logs_futuros = session.execute(text("""
            SELECT COUNT(*) as count
            FROM crm_oportunidad_log_estado
            WHERE fecha_registro > NOW()
        """)).scalar()
        
        print(f"   📊 Logs con fecha futura: {logs_futuros}")
        
        print(f"\n=== RESUMEN ===")
        print(f"Total logs: {total_logs}")
        print(f"Total oportunidades: {total_oportunidades}")
        print(f"Oportunidades sin logs: {oportunidades_sin_logs}")
        print(f"Inconsistencias: {inconsistencias}")
        print(f"Logs con fecha futura: {logs_futuros}")
        
        if inconsistencias > 0 or oportunidades_sin_logs > 0:
            print("⚠️  Se encontraron inconsistencias que requieren atención")
        else:
            print("✅ Los datos parecen consistentes")
            
    except Exception as e:
        print(f"❌ Error durante la verificación: {e}")
        import traceback
        traceback.print_exc()
    finally:
        session.close()

if __name__ == "__main__":
    verificar_tabla_log_estado()