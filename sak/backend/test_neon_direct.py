#!/usr/bin/env python3
"""
Test directo de conectividad a Neon
Sin FastAPI, sin SQLModel - solo psycopg puro
"""

import psycopg
import time
from dotenv import load_dotenv
import os

# Cargar variables de entorno
load_dotenv()

DATABASE_URL = os.getenv("DATABASE_URL")

# Convertir URL de SQLAlchemy a psycopg puro
if DATABASE_URL.startswith("postgresql+psycopg://"):
    DATABASE_URL = DATABASE_URL.replace("postgresql+psycopg://", "postgresql://")

print("🔗 Conectando directamente a Neon...")
print(f"📡 URL: {DATABASE_URL[:50]}...{'sslmode=require' if 'sslmode=require' in DATABASE_URL else ''}")

try:
    print("⏱️  Iniciando conexión...")
    start_time = time.time()
    
    # Conexión directa con psycopg
    with psycopg.connect(DATABASE_URL) as conn:
        connection_time = time.time() - start_time
        print(f"✅ Conexión establecida en {connection_time:.2f} segundos")
        
        print("📊 Probando query simple...")
        query_start = time.time()
        
        with conn.cursor() as cur:
            # Query simple: contar usuarios
            cur.execute("SELECT COUNT(*) as total FROM users WHERE deleted_at IS NULL")
            total = cur.fetchone()[0]
            
            query_time = time.time() - query_start
            print(f"✅ Query COUNT exitosa en {query_time:.2f} segundos")
            print(f"👥 Total usuarios: {total}")
            
            # Query para traer usuarios
            print("📋 Obteniendo lista de usuarios...")
            list_start = time.time()
            
            cur.execute("""
                SELECT id, nombre, email, telefono, created_at 
                FROM users 
                WHERE deleted_at IS NULL 
                ORDER BY id 
                LIMIT 10
            """)
            
            users = cur.fetchall()
            list_time = time.time() - list_start
            
            print(f"✅ Query LIST exitosa en {list_time:.2f} segundos")
            print(f"📄 Usuarios encontrados: {len(users)}")
            
            # Mostrar usuarios
            print("\n👥 Lista de usuarios:")
            for user in users:
                id, nombre, email, telefono, created_at = user
                print(f"  🆔 {id}: {nombre} ({email}) - {created_at.strftime('%Y-%m-%d')}")
        
        total_time = time.time() - start_time
        print(f"\n⚡ Tiempo total: {total_time:.2f} segundos")
        print("🎯 Conexión directa a Neon: ✅ FUNCIONANDO")

except psycopg.OperationalError as e:
    print(f"❌ Error de conexión a Neon: {e}")
except psycopg.DatabaseError as e:
    print(f"❌ Error de base de datos: {e}")
except Exception as e:
    print(f"❌ Error general: {e}")
    import traceback
    print(traceback.format_exc())

print("\n📝 Si este script funciona pero FastAPI no, el problema está en la configuración de SQLModel/FastAPI")
print("📝 Si este script también falla, el problema es la conectividad de red Windows 11 → Neon")