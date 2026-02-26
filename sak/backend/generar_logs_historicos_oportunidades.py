"""
Script para generar logs históricos de estados de oportunidades
Genera logs para oportunidades que NO están en estado prospect (0-prospect)
"""
import os
import psycopg2
from urllib.parse import urlparse
from dotenv import load_dotenv

def generar_logs_historicos():
    """Generar logs históricos para oportunidades no-prospect"""
    
    # Cargar variables de entorno
    load_dotenv()
    database_url = os.getenv('DATABASE_URL')
    if not database_url:
        # Fallback a URL hardcodeada
        database_url = "postgresql+psycopg://neondb_owner:npg_2HqUWwPRtEy7@ep-steep-bird-acyo7x0e.sa-east-1.aws.neon.tech/neondb?sslmode=require"
    
    # Parsear URL
    database_url_clean = database_url.replace("postgresql+psycopg://", "postgresql://")
    parsed = urlparse(database_url_clean)
    
    try:
        conn = psycopg2.connect(
            host=parsed.hostname,
            database=parsed.path[1:],
            user=parsed.username,
            password=parsed.password,
            port=parsed.port or 5432,
            sslmode='require'
        )
        cursor = conn.cursor()
        
        print("=== GENERACIÓN DE LOGS HISTÓRICOS DE OPORTUNIDADES ===\n")
        
        # 1. Verificar estado actual de logs
        print("1. Estado actual de logs:")
        cursor.execute("SELECT COUNT(*) FROM crm_oportunidad_log_estado")
        total_logs_actual = cursor.fetchone()[0]
        print(f"   Total logs existentes: {total_logs_actual}")
        
        # 2. Analizar oportunidades por estado
        print("\n2. Análisis de oportunidades:")
        cursor.execute("""
            SELECT 
                estado,
                COUNT(*) as total,
                MIN(fecha_estado) as fecha_min,
                MAX(fecha_estado) as fecha_max
            FROM crm_oportunidades 
            GROUP BY estado 
            ORDER BY estado
        """)
        estados = cursor.fetchall()
        
        prospect_count = 0
        no_prospect_count = 0
        
        for estado, total, fecha_min, fecha_max in estados:
            print(f"   {estado}: {total} oportunidades ({fecha_min} a {fecha_max})")
            if estado == '0-prospect':
                prospect_count = total
            else:
                no_prospect_count += total
        
        print(f"\n   📊 Resumen:")
        print(f"   - Oportunidades prospect (SIN log): {prospect_count}")
        print(f"   - Oportunidades no-prospect (CON log): {no_prospect_count}")
        
        # 3. Preparar inserción de logs
        print(f"\n3. Preparando logs históricos...")
        
        # Obtener oportunidades que NO están en prospect
        cursor.execute("""
            SELECT id, estado, fecha_estado, titulo
            FROM crm_oportunidades 
            WHERE estado != '0-prospect'
            ORDER BY estado, id
        """)
        oportunidades_para_log = cursor.fetchall()
        
        print(f"   Oportunidades a procesar: {len(oportunidades_para_log)}")
        
        if len(oportunidades_para_log) == 0:
            print("   ℹ️  No hay oportunidades para procesar")
            return
        
        # 4. Mostrar muestra de lo que se va a insertar
        print(f"\n4. Muestra de logs a crear (primeros 5):")
        for i, (opp_id, estado, fecha_estado, titulo) in enumerate(oportunidades_para_log[:5]):
            titulo_corto = titulo[:40] + "..." if titulo and len(titulo) > 40 else titulo
            print(f"   ID {opp_id}: null → {estado} ({fecha_estado}) [{titulo_corto}]")
        
        if len(oportunidades_para_log) > 5:
            print(f"   ... y {len(oportunidades_para_log) - 5} más")
        
        # 5. Confirmación
        confirm = input(f"\n¿Crear {len(oportunidades_para_log)} logs históricos? [y/N]: ")
        
        if confirm.lower() not in ['y', 'yes', 's', 'si']:
            print("❌ Operación cancelada")
            return
        
        # 6. Insertar logs
        print(f"\n6. Insertando logs históricos...")
        
        logs_insertados = 0
        for opp_id, estado, fecha_estado, titulo in oportunidades_para_log:
            try:
                cursor.execute("""
                    INSERT INTO crm_oportunidad_log_estado (
                        oportunidad_id,
                        estado_anterior,
                        estado_nuevo,
                        descripcion,
                        usuario_id,
                        fecha_registro,
                        created_at,
                        updated_at,
                        version
                    ) VALUES (%s, %s, %s, %s, %s, %s, NOW(), NOW(), 1)
                """, (
                    opp_id,
                    "0-prospect",  # estado_anterior = "0-prospect" (estado inicial válido)
                    estado,
                    f"Log histórico generado automáticamente para estado {estado}",
                    1,  # usuario_id = 1 (sistema)
                    fecha_estado
                ))
                logs_insertados += 1
                
                if logs_insertados % 20 == 0:
                    print(f"   Procesados: {logs_insertados}/{len(oportunidades_para_log)}")
                    
            except Exception as e:
                print(f"   ⚠️  Error en oportunidad {opp_id}: {e}")
        
        # 7. Confirmar transacción
        conn.commit()
        print(f"   ✅ {logs_insertados} logs creados exitosamente")
        
        # 8. Verificación final
        print(f"\n8. Verificación final:")
        cursor.execute("SELECT COUNT(*) FROM crm_oportunidad_log_estado")
        total_logs_final = cursor.fetchone()[0]
        print(f"   Total logs después: {total_logs_final}")
        print(f"   Logs nuevos: {total_logs_final - total_logs_actual}")
        
        # 9. Estadísticas por estado
        print(f"\n9. Logs por estado generados:")
        cursor.execute("""
            SELECT 
                estado_nuevo,
                COUNT(*) as cantidad
            FROM crm_oportunidad_log_estado
            WHERE descripcion LIKE 'Log histórico generado automáticamente%'
            GROUP BY estado_nuevo
            ORDER BY estado_nuevo
        """)
        estadisticas = cursor.fetchall()
        
        for estado, cantidad in estadisticas:
            print(f"   {estado}: {cantidad} logs")
        
        cursor.close()
        conn.close()
        
        print(f"\n✅ Proceso completado exitosamente")
        
    except Exception as e:
        print(f"❌ Error: {e}")

if __name__ == "__main__":
    generar_logs_historicos()