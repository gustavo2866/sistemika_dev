#!/usr/bin/env python3
"""
Ver qué usuarios existen en la base de datos para usar como solicitantes
"""

import sys
sys.path.insert(0, '.')
from sqlmodel import Session, select
from app.db import get_session
from app.models.user import User

def ver_usuarios():
    print('=== USUARIOS DISPONIBLES ===')
    
    try:
        session = next(get_session())
        
        # Obtener todos los usuarios
        usuarios = session.exec(select(User)).all()
        print(f'Total usuarios: {len(usuarios)}')
        
        if len(usuarios) > 0:
            print('\nUsuarios disponibles:')
            print('ID   | Nombre                           | Email')
            print('-' * 70)
            
            for usuario in usuarios:
                nombre = usuario.nombre if usuario.nombre else 'SIN NOMBRE'
                email = usuario.email if usuario.email else 'SIN EMAIL'
                print(f'{usuario.id:4d} | {nombre:32s} | {email}')
        
    except Exception as e:
        print(f'❌ ERROR: {e}')
        import traceback
        traceback.print_exc()

if __name__ == "__main__":
    ver_usuarios()