#!/usr/bin/env python3
"""
Diagnóstico completo de problemas con Neon
"""

import os
import time
import socket
from dotenv import load_dotenv

# Cargar .env
load_dotenv()
DATABASE_URL = os.getenv("DATABASE_URL")

print("🔍 DIAGNÓSTICO DE NEON")
print("=" * 50)

# 1. Verificar URL
print("1️⃣ Verificando configuración...")
if not DATABASE_URL:
    print("❌ DATABASE_URL no encontrada")
    exit(1)

print("✅ DATABASE_URL encontrada")

# 2. Extraer componentes
if DATABASE_URL.startswith("postgresql+psycopg://"):
    clean_url = DATABASE_URL.replace("postgresql+psycopg://", "")
else:
    clean_url = DATABASE_URL.replace("postgresql://", "")

# Extraer host
try:
    host_part = clean_url.split('@')[1].split('/')[0]
    if '?' in host_part:
        host_part = host_part.split('?')[0]
    
    print(f"🏠 Host: {host_part}")
    
    # 3. Test de conectividad básica
    print("\n2️⃣ Test de conectividad de red...")
    
    # Separar host y puerto
    if ':' in host_part:
        host, port = host_part.rsplit(':', 1)
        port = int(port)
    else:
        host = host_part
        port = 5432
    
    print(f"🌐 Probando conexión a {host}:{port}")
    
    start_time = time.time()
    sock = socket.socket(socket.AF_INET, socket.SOCK_STREAM)
    sock.settimeout(10)  # 10 segundos timeout
    
    try:
        result = sock.connect_ex((host, port))
        duration = time.time() - start_time
        
        if result == 0:
            print(f"✅ Puerto alcanzable en {duration:.2f}s")
        else:
            print(f"❌ Puerto no alcanzable (error: {result})")
    finally:
        sock.close()
        
except Exception as e:
    print(f"❌ Error parseando URL: {e}")

print("\n3️⃣ Problemas comunes de Neon:")
print("- 🕐 Sleep mode: El compute puede estar durmiendo (plan gratuito)")
print("- 🌍 Latencia: sa-east-1 puede tener alta latencia")  
print("- 🔒 SSL: Neon requiere sslmode=require")
print("- 📊 Pooler: Usar -pooler puede mejorar la velocidad")

print("\n4️⃣ Soluciones recomendadas:")
print("- Usar SQLite para desarrollo local: DATABASE_URL=sqlite:///./sak_dev.db")
print("- Activar pooler: descomenta la línea con -pooler en .env") 
print("- Esperar 30-60s para que el compute despierte")

print("\n💡 ¿Quieres cambiar a SQLite para desarrollo?")