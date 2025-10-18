#!/usr/bin/env python3
"""Script para comparar usuarios entre base de datos Neon y Local"""

from sqlalchemy import create_engine, text

# URLs de conexión
NEON_URL = "postgresql+psycopg://neondb_owner:npg_2HqUWwPRtEy7@ep-steep-bird-acyo7x0e-pooler.sa-east-1.aws.neon.tech/neondb?sslmode=require"
LOCAL_URL = "postgresql+psycopg://sak_user:cambia_esta_clave@localhost:5432/sak"

def get_users(db_url, db_name):
    """Obtiene los usuarios de una base de datos"""
    print(f"\n{'='*60}")
    print(f"📊 {db_name}")
    print(f"{'='*60}")
    
    try:
        engine = create_engine(db_url)
        with engine.connect() as conn:
            result = conn.execute(text("""
                SELECT id, nombre, email, telefono, url_foto, pais_id, 
                       created_at, updated_at 
                FROM users 
                ORDER BY id
            """))
            users = result.fetchall()
            
            print(f"Total de usuarios: {len(users)}\n")
            
            for user in users:
                print(f"ID: {user[0]}")
                print(f"  Nombre: {user[1]}")
                print(f"  Email: {user[2]}")
                print(f"  Teléfono: {user[3]}")
                print(f"  Foto: {user[4]}")
                print(f"  País ID: {user[5]}")
                print(f"  Creado: {user[6]}")
                print(f"  Actualizado: {user[7]}")
                print()
            
            return users
            
    except Exception as e:
        print(f"❌ Error al conectar a {db_name}: {str(e)}")
        return []

if __name__ == "__main__":
    print("\n🔍 COMPARACIÓN DE USUARIOS ENTRE BASES DE DATOS")
    
    # Obtener usuarios de ambas bases
    neon_users = get_users(NEON_URL, "NEON (Producción)")
    local_users = get_users(LOCAL_URL, "LOCAL (Desarrollo)")
    
    # Comparación
    print(f"\n{'='*60}")
    print("📋 RESUMEN DE COMPARACIÓN")
    print(f"{'='*60}")
    print(f"Usuarios en Neon: {len(neon_users)}")
    print(f"Usuarios en Local: {len(local_users)}")
    print(f"Diferencia: {len(neon_users) - len(local_users)} usuarios")
    
    # Usuarios en Neon pero no en Local
    neon_ids = {user[0] for user in neon_users}
    local_ids = {user[0] for user in local_users}
    
    only_in_neon = neon_ids - local_ids
    only_in_local = local_ids - neon_ids
    
    if only_in_neon:
        print(f"\n⚠️ Usuarios solo en Neon: {only_in_neon}")
    
    if only_in_local:
        print(f"\n⚠️ Usuarios solo en Local: {only_in_local}")
    
    if not only_in_neon and not only_in_local:
        print("\n✅ Ambas bases tienen los mismos IDs de usuarios")
