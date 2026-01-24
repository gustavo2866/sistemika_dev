#!/usr/bin/env python3
"""
Test usando las recomendaciones oficiales de Neon para SQLAlchemy
"""
import os
import time
from dotenv import load_dotenv
from sqlalchemy import create_engine, text

# Cargar variables de entorno
load_dotenv()

def test_neon_official_config():
    """Test con configuración recomendada por Neon para SQLAlchemy"""
    
    database_url = os.getenv("DATABASE_URL")
    if not database_url:
        print("❌ No se encontró DATABASE_URL")
        return False
    
    print(f"🔗 URL de conexión: {database_url[:50]}...")
    
    try:
        # Configuración oficial recomendada por Neon
        engine = create_engine(
            database_url,
            pool_pre_ping=True,     # CRITICAL: Neon recomienda esto
            pool_recycle=300,       # 5 minutos - menor al scale-to-zero de Neon
            pool_size=5,            # Pool pequeño para debugging
            max_overflow=0,         # Sin overflow para simplificar
            echo=False,
            connect_args={
                "sslmode": "require"  # SSL requerido para Neon
            }
        )
        
        print("✅ Engine creado con configuración oficial de Neon")
        
        # Test de conexión simple
        print("🔄 Intentando conectar...")
        start_time = time.time()
        
        with engine.connect() as connection:
            result = connection.execute(text("SELECT 'Hello Neon' as message"))
            row = result.fetchone()
            connection_time = time.time() - start_time
            
            print(f"✅ Conexión exitosa en {connection_time:.2f}s")
            print(f"📨 Resultado: {row[0]}")
            
            # Test adicional - consulta a tabla de usuarios
            print("🔄 Probando consulta a tabla users...")
            start_time = time.time()
            
            result = connection.execute(text("SELECT COUNT(*) as total FROM users"))
            row = result.fetchone()
            query_time = time.time() - start_time
            
            print(f"✅ Query exitosa en {query_time:.2f}s")
            print(f"👥 Total usuarios: {row[0]}")
            
        return True
        
    except Exception as e:
        print(f"❌ Error: {e}")
        print(f"🕐 Tiempo transcurrido: {time.time() - start_time:.2f}s")
        return False

def test_direct_connection():
    """Test directo con psycopg3 sin SQLAlchemy"""
    print("\n" + "="*50)
    print("🧪 TEST: Conexión directa psycopg3")
    print("="*50)
    
    import psycopg
    
    database_url = os.getenv("DATABASE_URL")
    if not database_url:
        print("❌ No se encontró DATABASE_URL")
        return False
    
    # Convertir URL de SQLAlchemy a psycopg
    if database_url.startswith("postgresql+psycopg://"):
        psycopg_url = database_url.replace("postgresql+psycopg://", "postgresql://")
    else:
        psycopg_url = database_url
    
    print(f"🔗 URL psycopg: {psycopg_url[:50]}...")
    
    try:
        start_time = time.time()
        
        with psycopg.connect(psycopg_url) as conn:
            connection_time = time.time() - start_time
            print(f"✅ Conexión directa exitosa en {connection_time:.2f}s")
            
            with conn.cursor() as cur:
                # Test simple
                cur.execute("SELECT 'Hello Direct Neon' as message")
                result = cur.fetchone()
                print(f"📨 Resultado: {result[0]}")
                
                # Test usuarios
                start_time = time.time()
                cur.execute("SELECT COUNT(*) FROM users")
                result = cur.fetchone()
                query_time = time.time() - start_time
                
                print(f"✅ Query usuarios en {query_time:.2f}s")
                print(f"👥 Total usuarios: {result[0]}")
        
        return True
        
    except Exception as e:
        print(f"❌ Error directo: {e}")
        print(f"🕐 Tiempo transcurrido: {time.time() - start_time:.2f}s")
        return False

if __name__ == "__main__":
    print("🧪 TESTING NEON CONNECTION - CONFIGURACIÓN OFICIAL")
    print("="*60)
    
    # Test 1: SQLAlchemy con configuración oficial de Neon
    print("🧪 TEST: SQLAlchemy con configuración oficial Neon")
    print("="*50)
    success_sqlalchemy = test_neon_official_config()
    
    # Test 2: Conexión directa para comparar
    success_direct = test_direct_connection()
    
    print("\n" + "="*60)
    print("📊 RESUMEN DE TESTS")
    print("="*60)
    print(f"SQLAlchemy (oficial): {'✅ ÉXITO' if success_sqlalchemy else '❌ FALLO'}")
    print(f"Psycopg directo:      {'✅ ÉXITO' if success_direct else '❌ FALLO'}")
    
    if success_sqlalchemy:
        print("\n🎉 ¡El problema estaba en la configuración de SQLAlchemy!")
        print("   La configuración oficial de Neon resolvió el problema.")
    elif success_direct:
        print("\n🤔 El problema está específicamente en SQLAlchemy")
        print("   La conexión directa funciona pero SQLAlchemy no.")
    else:
        print("\n😵 Ambos fallan - problema más profundo de conectividad")