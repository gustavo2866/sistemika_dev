#!/usr/bin/env python3
"""
Test simple de conectividad a Neon siguiendo la documentación oficial
"""

import os
import psycopg
from dotenv import load_dotenv

# Cargar variables de entorno
load_dotenv()

DATABASE_URL = os.getenv("DATABASE_URL")

# Convertir de SQLAlchemy a formato psycopg puro (requerido)
if DATABASE_URL and DATABASE_URL.startswith("postgresql+psycopg://"):
    DATABASE_URL = DATABASE_URL.replace("postgresql+psycopg://", "postgresql://")
    
print("🔗 Test de conexión a Neon")
print(f"📡 URL: {DATABASE_URL[:70]}...")

if not DATABASE_URL:
    print("❌ No se encontró DATABASE_URL en .env")
    exit(1)

try:
    # Conexión simple siguiendo documentación de Neon
    print("⏱️  Conectando...")
    
    with psycopg.connect(DATABASE_URL) as conn:
        print("✅ Conexión establecida exitosamente!")
        
        with conn.cursor() as cur:
            # Test 1: Query simple
            cur.execute("SELECT 1 as test")
            result = cur.fetchone()
            print(f"✅ Query test: {result[0]}")
            
            # Test 2: Información de la base de datos
            cur.execute("SELECT version()")
            version = cur.fetchone()[0]
            print(f"📊 PostgreSQL: {version[:50]}...")
            
            # Test 3: Contar tablas del proyecto
            cur.execute("""
                SELECT COUNT(*) 
                FROM information_schema.tables 
                WHERE table_schema = 'public'
            """)
            table_count = cur.fetchone()[0]
            print(f"📋 Tablas en schema público: {table_count}")
            
            # Test 4: Verificar usuarios si existe la tabla
            try:
                cur.execute("SELECT COUNT(*) FROM users WHERE deleted_at IS NULL")
                user_count = cur.fetchone()[0]
                print(f"👥 Usuarios activos: {user_count}")
            except psycopg.errors.UndefinedTable:
                print("⚠️ Tabla 'users' no existe (normal si es DB nueva)")
            
            print("\n🎉 Todos los tests pasaron - Conexión a Neon OK!")
            
except psycopg.OperationalError as e:
    print(f"❌ Error de conexión: {e}")
    print("\n💡 Posibles causas:")
    print("   - Verificar credenciales en .env")
    print("   - Revisar URL de conexión")
    print("   - Verificar conectividad a internet")
    
except Exception as e:
    print(f"❌ Error inesperado: {e}")