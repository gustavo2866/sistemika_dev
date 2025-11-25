"""
Script para poblar el campo fecha_mensaje con valores variados
"""
from datetime import datetime, timedelta
import random
from sqlalchemy import create_engine, text

# Conectar a la base local
engine = create_engine('postgresql+psycopg://sak_user:cambia_esta_clave@localhost:5432/sak')
conn = engine.connect()

try:
    # Obtener todos los mensajes
    result = conn.execute(text("SELECT id, created_at FROM crm_mensajes ORDER BY id"))
    mensajes = result.fetchall()
    
    print(f"\nEncontrados {len(mensajes)} mensajes para actualizar")
    
    if len(mensajes) == 0:
        print("No hay mensajes en la tabla")
    else:
        # Generar fechas variadas en los últimos 90 días
        fecha_base = datetime.now()
        
        for mensaje_id, created_at in mensajes:
            # Generar una fecha aleatoria en los últimos 90 días
            dias_atras = random.randint(0, 90)
            horas_aleatorias = random.randint(0, 23)
            minutos_aleatorios = random.randint(0, 59)
            
            # Calcular fecha_mensaje
            fecha_mensaje = fecha_base - timedelta(
                days=dias_atras,
                hours=horas_aleatorias,
                minutes=minutos_aleatorios
            )
            
            # Actualizar el registro
            conn.execute(
                text("""
                    UPDATE crm_mensajes 
                    SET fecha_mensaje = :fecha_mensaje 
                    WHERE id = :id
                """),
                {"fecha_mensaje": fecha_mensaje, "id": mensaje_id}
            )
            
            print(f"  Mensaje {mensaje_id}: {fecha_mensaje.strftime('%Y-%m-%d %H:%M:%S')}")
        
        conn.commit()
        print(f"\n✓ {len(mensajes)} mensajes actualizados con fechas variadas")
        
        # Mostrar estadísticas
        result = conn.execute(text("""
            SELECT 
                MIN(fecha_mensaje) as primera_fecha,
                MAX(fecha_mensaje) as ultima_fecha,
                COUNT(*) as total
            FROM crm_mensajes
        """))
        stats = result.fetchone()
        
        print("\nEstadísticas:")
        print(f"  Primera fecha: {stats[0]}")
        print(f"  Última fecha:  {stats[1]}")
        print(f"  Total:         {stats[2]}")

except Exception as e:
    print(f"\n✗ Error: {e}")
    conn.rollback()
finally:
    conn.close()
