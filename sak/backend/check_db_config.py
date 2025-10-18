#!/usr/bin/env python3
"""Script para verificar la configuración actual de la base de datos"""

import os
from dotenv import load_dotenv

# Cargar variables de entorno
load_dotenv()

db_url = os.getenv('DATABASE_URL')

print("="*70)
print("🔍 VERIFICACIÓN DE CONFIGURACIÓN DE BASE DE DATOS")
print("="*70)
print()
print("📄 DATABASE_URL cargada desde .env:")
print(db_url)
print()

if 'neon' in db_url:
    print("✅ Backend configurado para NEON (Producción)")
    print("   Host: ep-steep-bird-acyo7x0e-pooler.sa-east-1.aws.neon.tech")
    print("   Database: neondb")
    print("   Región: sa-east-1 (São Paulo)")
    
    # Verificar conexión
    print()
    print("🔌 Probando conexión a Neon...")
    try:
        from app.db import engine
        from sqlalchemy import text
        
        with engine.connect() as conn:
            result = conn.execute(text("SELECT COUNT(*) FROM users"))
            user_count = result.scalar()
            print(f"   ✅ Conexión exitosa - {user_count} usuarios en la tabla users")
            
            # Verificar tabla nominas
            try:
                result = conn.execute(text("SELECT COUNT(*) FROM nominas"))
                nomina_count = result.scalar()
                print(f"   ✅ Tabla nominas existe - {nomina_count} registros")
            except Exception as e:
                print(f"   ❌ Tabla nominas: {str(e)}")
                
    except Exception as e:
        print(f"   ❌ Error de conexión: {str(e)}")

elif 'localhost' in db_url:
    print("⚠️  Backend configurado para LOCAL (Desarrollo)")
    print("   Host: localhost:5432")
    print("   Database: sak")
    
    # Verificar conexión
    print()
    print("🔌 Probando conexión a PostgreSQL Local...")
    try:
        from app.db import engine
        from sqlalchemy import text
        
        with engine.connect() as conn:
            result = conn.execute(text("SELECT COUNT(*) FROM users"))
            user_count = result.scalar()
            print(f"   ✅ Conexión exitosa - {user_count} usuarios en la tabla users")
            
            # Verificar tabla nominas
            try:
                result = conn.execute(text("SELECT COUNT(*) FROM nominas"))
                nomina_count = result.scalar()
                print(f"   ✅ Tabla nominas existe - {nomina_count} registros")
            except Exception as e:
                print(f"   ❌ Tabla nominas no existe o error: {str(e)}")
                
    except Exception as e:
        print(f"   ❌ Error de conexión: {str(e)}")
else:
    print("❌ Configuración desconocida")

print()
print("="*70)
