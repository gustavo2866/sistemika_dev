#!/usr/bin/env python3
"""
Script para probar la conexión con la base de datos después de reinstalar dependencias
"""

import os
from dotenv import load_dotenv
from sqlmodel import create_engine, Session, SQLModel, text
import asyncio

# Cargar variables de entorno
load_dotenv()

async def test_database_connection():
    """Prueba la conexión con la base de datos"""
    
    # Obtener URL de la base de datos
    database_url = os.getenv('DATABASE_URL')
    
    if not database_url:
        print("❌ ERROR: DATABASE_URL no está configurado")
        return False
    
    print(f"🔍 Probando conexión con: {database_url[:50]}...")
    
    try:
        # Crear engine de SQLAlchemy
        engine = create_engine(database_url)
        
        # Intentar crear una sesión y hacer una consulta simple
        with Session(engine) as session:
            # Hacer una consulta simple para probar la conexión
            result = session.exec(text("SELECT 1 as test"))
            test_value = result.first()
            
            if test_value and test_value[0] == 1:
                print("✅ ¡Conexión exitosa! La base de datos responde correctamente.")
                
                # Probar información adicional de la base de datos
                result = session.exec(text("SELECT version()"))
                db_version = result.first()
                if db_version:
                    print(f"📊 Versión de PostgreSQL: {db_version[0]}")
                
                return True
            else:
                print("❌ ERROR: La consulta de prueba no devolvió el resultado esperado")
                return False
                
    except Exception as e:
        print(f"❌ ERROR al conectar con la base de datos: {str(e)}")
        print(f"Tipo de error: {type(e).__name__}")
        return False

if __name__ == "__main__":
    print("🚀 Iniciando prueba de conexión a base de datos...")
    print("=" * 60)
    
    success = asyncio.run(test_database_connection())
    
    print("=" * 60)
    if success:
        print("🎉 ¡PRUEBA EXITOSA! El entorno está listo para usar.")
    else:
        print("💥 PRUEBA FALLIDA. Revisa la configuración de la base de datos.")