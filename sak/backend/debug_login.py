#!/usr/bin/env python3
"""
Script para verificar y debuggear el sistema de login
"""

import asyncio
from sqlmodel import Session, select
from app.db import get_session
from app.models.user import User
from app.api.auth import hash_password, create_token

async def main():
    print("🔍 Debuggeando sistema de login...\n")
    
    # Obtener sesión de base de datos
    session_gen = get_session()
    session = next(session_gen)
    
    try:
        # 1. Verificar usuarios existentes
        print("1️⃣ Verificando usuarios en la base de datos:")
        users = session.exec(select(User)).all()
        
        if not users:
            print("❌ No hay usuarios en la base de datos!")
            print("   Necesitas crear al menos un usuario para hacer login.")
        else:
            print(f"✅ Encontrados {len(users)} usuarios:")
            for user in users[:5]:  # Solo mostrar los primeros 5
                print(f"   - ID: {user.id}, Nombre: {user.nombre}, Email: {user.email}")
        
        print()
        
        # 2. Verificar la estructura de la tabla users
        print("2️⃣ Verificando estructura de tabla users:")
        result = session.exec(select(User).limit(1)).first()
        if result:
            attrs = [attr for attr in dir(result) if not attr.startswith('_') and not callable(getattr(result, attr))]
            print(f"   Campos disponibles: {attrs}")
            
            # Verificar si hay campo password
            if hasattr(result, 'password'):
                print("✅ Campo 'password' encontrado en User")
            else:
                print("❌ Campo 'password' NO encontrado en User")
                print("   El sistema de login no puede verificar passwords!")
        
        print()
        
        # 3. Probar creación de token
        print("3️⃣ Probando creación de JWT token:")
        if users:
            test_user = users[0]
            try:
                token = create_token(test_user.id)
                print(f"✅ Token creado exitosamente: {token[:20]}...")
            except Exception as e:
                print(f"❌ Error creando token: {e}")
        
        print()
        
        # 4. Sugerir soluciones
        print("4️⃣ Sugerencias para solucionar problemas:")
        if not users:
            print("   📝 Crear un usuario de prueba:")
            print("      - Ve a http://localhost:8000/docs")
            print("      - Usa POST /api/v1/users/ para crear un usuario")
            print("      - Luego intenta login con ese email")
        elif not hasattr(result, 'password'):
            print("   📝 El modelo User no tiene campo password:")
            print("      - El login actual acepta cualquier password (modo desarrollo)")
            print("      - Solo verifica que el usuario exista")
            print("      - En producción necesitarías agregar campo password")
            
        print()
        print("🔧 Para probar login desde Swagger:")
        print("   1. Ve a http://localhost:8000/docs")
        print("   2. Encuentra POST /api/auth/login")
        print("   3. Usa un email que exista en la lista de arriba")
        print("   4. Usa cualquier password (el sistema no la verifica)")
        
    except Exception as e:
        print(f"❌ Error durante debugging: {e}")
        import traceback
        print(traceback.format_exc())
    
    finally:
        session.close()

if __name__ == "__main__":
    asyncio.run(main())