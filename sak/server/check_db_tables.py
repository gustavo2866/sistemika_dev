import sqlite3
import sys
import os

# Cambiar al directorio del servidor
server_dir = r"C:\Users\gpalmieri\source\sistemika\sak\server"
os.chdir(server_dir)

# Conectar a la base de datos usando la misma ruta que el backend
db_path = "./data/dev.db"

try:
    conn = sqlite3.connect(db_path)
    cursor = conn.cursor()
    
    # Obtener lista de tablas
    cursor.execute("SELECT name FROM sqlite_master WHERE type='table';")
    tables = cursor.fetchall()
    
    print("Tables in database:", [t[0] for t in tables])
    
    # Si existe la tabla users, contar registros
    if any('users' in str(t) for t in tables):
        cursor.execute("SELECT COUNT(*) FROM users;")
        count = cursor.fetchone()[0]
        print(f"Users count: {count}")
        
        # Mostrar algunos usuarios
        cursor.execute("SELECT id, nombre, email FROM users LIMIT 3;")
        users = cursor.fetchall()
        print("Sample users:", users)
    
    conn.close()
    print("Database check completed successfully")

except Exception as e:
    print(f"Error: {e}")
