#!/usr/bin/env python3

import sys
import os
sys.path.append(os.path.dirname(os.path.abspath(__file__)))

from sqlmodel import Session
from app.db import engine
from app.models.user import User
from sqlmodel import select
import hashlib

def hash_password(password: str) -> str:
    """Hashear contraseña usando el mismo método que el auth"""
    return hashlib.sha256(password.encode()).hexdigest()

def check_and_create_users():
    try:
        with Session(engine) as session:
            # Verificar usuarios existentes
            users = session.exec(select(User)).all()
            print('=== USUARIOS EXISTENTES ===')
            
            if users:
                for user in users:
                    print(f'🆔 ID: {user.id}')
                    print(f'👤 Nombre: {user.nombre}')
                    print(f'📧 Email: {user.email}')
                    print(f'📞 Teléfono: {user.telefono or "N/A"}')
                    print('-' * 40)
                print(f'📊 Total usuarios: {len(users)}')
            else:
                print('❌ No hay usuarios en la base de datos')
            
            # Crear usuario de prueba si no existe
            test_user = session.exec(select(User).where(User.email == "admin@test.com")).first()
            
            if not test_user:
                print('\n=== CREANDO USUARIO DE PRUEBA ===')
                new_user = User(
                    nombre="Administrador Test",
                    email="admin@test.com", 
                    telefono="123456789",
                    url_foto="https://api.dicebear.com/7.x/avataaars/svg?seed=admin"
                )
                session.add(new_user)
                session.commit()
                session.refresh(new_user)
                
                print(f'✅ Usuario creado exitosamente!')
                print(f'👤 Nombre: {new_user.nombre}')
                print(f'📧 Email: {new_user.email}')
                print(f'🆔 ID: {new_user.id}')
                print('\n🔑 CREDENCIALES PARA PROBAR:')
                print('Username: admin@test.com')
                print('Password: admin123')
                print('\nNOTA: El sistema usa el email como username')
            else:
                print(f'\n✅ Usuario de prueba ya existe:')
                print(f'👤 Nombre: {test_user.nombre}')
                print(f'📧 Email: {test_user.email}')
                print('\n🔑 CREDENCIALES PARA PROBAR:')
                print('Username: admin@test.com')
                print('Password: admin123')
            
    except Exception as e:
        print(f'❌ Error: {e}')
        import traceback
        traceback.print_exc()

if __name__ == "__main__":
    check_and_create_users()
