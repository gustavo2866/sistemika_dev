#!/usr/bin/env python3

import sys
import os
sys.path.append(os.path.dirname(os.path.abspath(__file__)))

from app.db import get_session
from app.models.user import User
from sqlmodel import select

def check_users():
    try:
        with get_session() as session:
            users = session.exec(select(User)).all()
            print('=== USUARIOS EN LA BASE DE DATOS ===')
            
            if not users:
                print('❌ No hay usuarios en la base de datos')
                return False
            
            for user in users:
                print(f'🆔 ID: {user.id}')
                print(f'👤 Nombre: {user.nombre}')
                print(f'📧 Email: {user.email}')
                print(f'📞 Teléfono: {user.telefono or "N/A"}')
                print(f'🖼️ Foto: {user.url_foto or "N/A"}')
                print('-' * 40)
            
            print(f'📊 Total usuarios: {len(users)}')
            return True
            
    except Exception as e:
        print(f'❌ Error al acceder a la base de datos: {e}')
        return False

if __name__ == "__main__":
    check_users()
