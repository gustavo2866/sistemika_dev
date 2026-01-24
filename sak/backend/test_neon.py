#!/usr/bin/env python3
"""
Test rápido de conectividad a Neon
"""

import os
import time
from dotenv import load_dotenv
from sqlmodel import create_engine, text

# Cargar variables de entorno
load_dotenv()

DATABASE_URL = os.getenv("DATABASE_URL")

print("🔍 Probando conectividad a Neon...")
print(f"📡 URL: {DATABASE_URL[:50]}...") if DATABASE_URL else print("❌ No DATABASE_URL")

try:
    # Crear engine con timeout más corto para prueba
    engine = create_engine(
        DATABASE_URL,
        pool_pre_ping=True,
        pool_timeout=10,  # Timeout de 10 segundos
        connect_args={"connect_timeout": 10}  # Timeout de conexión
    )
    
    print("⏱️ Intentando conexión...")
    start_time = time.time()
    
    # Intentar una query simple
    with engine.connect() as conn:
        result = conn.execute(text("SELECT 1 as test"))
        row = result.fetchone()
        
    end_time = time.time()
    duration = end_time - start_time
    
    print(f"✅ Conexión exitosa!")
    print(f"⏱️ Tiempo: {duration:.2f} segundos")
    print(f"📊 Resultado: {row[0]}")
    
    # Probar query a usuarios
    print("\n👥 Probando query a usuarios...")
    start_time = time.time()
    
    with engine.connect() as conn:
        result = conn.execute(text("SELECT COUNT(*) as user_count FROM users"))
        count = result.fetchone()[0]
        
    end_time = time.time()
    duration = end_time - start_time
    
    print(f"✅ Query usuarios exitosa!")
    print(f"⏱️ Tiempo: {duration:.2f} segundos")
    print(f"👥 Total usuarios: {count}")
    
    if count == 0:
        print("⚠️ No hay usuarios en la base de datos!")
        print("   Esta puede ser la razón del error de login.")
    
except Exception as e:
    print(f"❌ Error de conexión: {e}")
    print("\n🔧 Posibles soluciones:")
    print("   1. Verifica tu conexión a internet")
    print("   2. Neon puede estar en hibernación (primer acceso es lento)")
    print("   3. Problemas de firewall en Windows 11")
    print("   4. Configura una base de datos local para desarrollo")

print("\nℹ️ Si es muy lento, considera usar PostgreSQL local para desarrollo")