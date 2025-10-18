#!/usr/bin/env python3
"""Script para verificar qué base de datos está usando el backend EN TIEMPO REAL"""

import sys
import os

# Forzar recarga del .env
from dotenv import load_dotenv
load_dotenv(override=True)

print("="*70)
print("🔍 VERIFICACIÓN EN TIEMPO REAL - CONFIGURACIÓN DEL BACKEND")
print("="*70)
print()

# 1. Ver qué dice el .env
db_url_env = os.getenv('DATABASE_URL')
print("1️⃣ DATABASE_URL desde .env:")
print(f"   {db_url_env}")
print()

# 2. Ver qué usa realmente app.db
print("2️⃣ Importando app.db para ver qué conexión usa...")
from app.db import engine

print(f"   URL del engine: {engine.url}")
print(f"   Database: {engine.url.database}")
print(f"   Host: {engine.url.host}")
print()

# 3. Hacer una consulta real
print("3️⃣ Consultando tabla users...")
from sqlalchemy import text

try:
    with engine.connect() as conn:
        result = conn.execute(text("SELECT id, nombre, email FROM users ORDER BY id"))
        users = result.fetchall()
        
        print(f"   Total de usuarios: {len(users)}")
        print()
        
        for user in users:
            print(f"   ID: {user[0]} - {user[1]} ({user[2]})")
            
        print()
        
        if len(users) == 2:
            print("   ⚠️ PROBLEMA: Solo 2 usuarios = BASE DE DATOS LOCAL")
            print("   El backend NO está usando Neon")
        elif len(users) == 5:
            print("   ✅ CORRECTO: 5 usuarios = BASE DE DATOS NEON")
        else:
            print(f"   ❓ DESCONOCIDO: {len(users)} usuarios")
            
except Exception as e:
    print(f"   ❌ Error: {str(e)}")

print()
print("="*70)
