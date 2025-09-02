#!/usr/bin/env python3
import sys
sys.path.insert(0, '.')

from app.models.user import User
from app.core.generic_crud import GenericCRUD
from app.db import get_session, init_db

# Inicializar DB
init_db()

# Crear CRUD
crud = GenericCRUD(User)

try:
    with next(get_session()) as session:
        items, total = crud.list(session, page=1, per_page=10)
        print(f'Users count: {total}')
        for user in items:
            print(f'  - ID: {user.id}, Nombre: {user.nombre}, Email: {user.email}')
        
        if total == 0:
            print("No hay usuarios. Creando datos de prueba...")
            
            test_users = [
                {"nombre": "Juan Pérez", "email": "juan@test.com", "telefono": "555-0001"},
                {"nombre": "María García", "email": "maria@test.com", "telefono": "555-0002"},
                {"nombre": "Carlos Rodríguez", "email": "carlos@test.com", "telefono": "555-0003"},
            ]
            
            for user_data in test_users:
                new_user = crud.create(session, user_data)
                print(f"Created: {new_user.nombre} (ID: {new_user.id})")
            
            print("✅ Datos de prueba creados!")
        
except Exception as e:
    import traceback
    print("ERROR:", e)
    traceback.print_exc()
