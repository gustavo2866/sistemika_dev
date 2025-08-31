import os
import time
from sqlmodel import SQLModel
from app.db import engine

# importar TODOS los modelos para que se registren en el metadata
from app.models.base import Base
from app.models.item import Item

# intentar eliminar la DB
try:
    if os.path.exists('test.db'):
        os.remove('test.db')
        print("Base de datos eliminada")
except Exception as e:
    print(f"No se pudo eliminar: {e}")

# esperar un momento
time.sleep(1)

# recrear todas las tablas
print("Recreando tablas...")
SQLModel.metadata.drop_all(engine)
SQLModel.metadata.create_all(engine)
print("Tablas recreadas exitosamente")

# verificar estructura
import sqlite3
conn = sqlite3.connect('test.db')
cursor = conn.cursor()
cursor.execute("SELECT sql FROM sqlite_master WHERE type='table' AND name='item'")
result = cursor.fetchone()
if result:
    print("Nueva estructura de la tabla 'item':")
    print(result[0])
conn.close()
