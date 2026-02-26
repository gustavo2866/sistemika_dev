"""
Script para actualizar campo 'activo' en oportunidades según regla de estados
Estados: prospect, ganada, perdida -> activo = false
Otros estados -> activo = true
"""
import os
import psycopg2
from urllib.parse import urlparse

def actualizar_campo_activo():
    """Actualizar campo activo según regla de estados"""
    
    # Leer DATABASE_URL desde .env
    database_url = os.getenv('DATABASE_URL')
    if not database_url:
        # Fallback a URL hardcodeada si no está en env
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
        
        print("=== ACTUALIZACION CAMPO ACTIVO EN OPORTUNIDADES ===\n")
        
        # 1. Verificar estado actual
        print("1. Estado actual:")
        cursor.execute("""
            SELECT 
                activo,
                COUNT(*) as cantidad
            FROM crm_oportunidades 
            GROUP BY activo 
            ORDER BY activo
        """)
        estado_actual = cursor.fetchall()
        
        for activo, cantidad in estado_actual:
            print(f"   activo={activo}: {cantidad} oportunidades")
        
        # 2. Ver distribución por estados
        print("\n2. Distribución por estados:")
        cursor.execute("""
            SELECT 
                estado,
                COUNT(*) as cantidad,
                COUNT(CASE WHEN activo = true THEN 1 END) as activo_true,
                COUNT(CASE WHEN activo = false THEN 1 END) as activo_false
            FROM crm_oportunidades 
            GROUP BY estado 
            ORDER BY estado
        """)
        estados = cursor.fetchall()
        
        for estado, total, activo_true, activo_false in estados:
            print(f"   {estado}: {total} total ({activo_true} activo=true, {activo_false} activo=false)")
        
        # 3. Aplicar regla de negocio
        print("\n3. Aplicando regla de negocio...")
        
        # Estados inactivos: prospect, ganada, perdida
        estados_inactivos = ['prospect', 'ganada', 'perdida', '0-prospect', '5-ganada', '6-perdida']
        
        # Actualizar a activo=false para estados inactivos
        cursor.execute("""
            UPDATE crm_oportunidades 
            SET activo = false, updated_at = NOW()
            WHERE estado = ANY(%s) AND activo = true
        """, (estados_inactivos,))
        
        inactivados = cursor.rowcount
        print(f"   Marcadas como inactivas: {inactivados} oportunidades")
        
        # Actualizar a activo=true para otros estados
        cursor.execute("""
            UPDATE crm_oportunidades 
            SET activo = true, updated_at = NOW()
            WHERE estado != ALL(%s) AND activo = false
        """, (estados_inactivos,))
        
        activados = cursor.rowcount
        print(f"   Marcadas como activas: {activados} oportunidades")
        
        # 4. Confirmar cambios
        if inactivados > 0 or activados > 0:
            confirm = input(f"\n¿Confirmar cambios? ({inactivados + activados} oportunidades afectadas) [y/N]: ")
            
            if confirm.lower() in ['y', 'yes', 's', 'si']:
                conn.commit()
                print("✅ Cambios aplicados exitosamente")
            else:
                conn.rollback()
                print("❌ Cambios cancelados")
        else:
            print("ℹ️  No hay cambios necesarios - todos los registros ya están correctos")
        
        # 5. Estado final
        print("\n5. Estado final:")
        cursor.execute("""
            SELECT 
                activo,
                COUNT(*) as cantidad
            FROM crm_oportunidades 
            GROUP BY activo 
            ORDER BY activo
        """)
        estado_final = cursor.fetchall()
        
        for activo, cantidad in estado_final:
            print(f"   activo={activo}: {cantidad} oportunidades")
        
        # 6. Verificación por estados
        print("\n6. Verificación por estados:")
        cursor.execute("""
            SELECT 
                estado,
                activo,
                COUNT(*) as cantidad
            FROM crm_oportunidades 
            GROUP BY estado, activo 
            ORDER BY estado, activo
        """)
        verificacion = cursor.fetchall()
        
        for estado, activo, cantidad in verificacion:
            print(f"   {estado} (activo={activo}): {cantidad}")
        
        cursor.close()
        conn.close()
        
    except Exception as e:
        print(f"Error: {e}")

if __name__ == "__main__":
    actualizar_campo_activo()