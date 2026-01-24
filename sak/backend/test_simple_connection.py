#!/usr/bin/env python3
"""
Prueba simple y directa de conexión a PostgreSQL
"""

import os
import psycopg
from dotenv import load_dotenv

load_dotenv()

def test_simple_connection():
    database_url = os.getenv('DATABASE_URL')
    
    if not database_url:
        print("❌ DATABASE_URL no encontrada")
        return False
    
    print("🔍 Probando conexión...")
    print(f"URL: {database_url[:60]}...")
    
    try:
        # Convertir de SQLAlchemy URL a psycopg URL si es necesario
        if database_url.startswith('postgresql+psycopg://'):
            database_url = database_url.replace('postgresql+psycopg://', 'postgresql://')
        
        # Conectar directamente con psycopg
        with psycopg.connect(database_url) as conn:
            with conn.cursor() as cur:
                cur.execute('SELECT version()')
                version = cur.fetchone()[0]
                print(f"✅ ¡CONEXIÓN EXITOSA!")
                print(f"📊 PostgreSQL: {version[:80]}...")
                return True
                
    except Exception as e:
        print(f"❌ Error: {e}")
        return False

if __name__ == "__main__":
    print("=" * 50)
    print("🚀 PRUEBA DIRECTA DE CONEXIÓN")
    print("=" * 50)
    
    if test_simple_connection():
        print("\n🎉 ¡EL AMBIENTE ESTÁ LISTO!")
        print("✅ Dependencias recompiladas correctamente")
        print("✅ Conexión a Neon DB funcional")
    else:
        print("\n💥 Hay problemas con la conexión")
    
    print("=" * 50)