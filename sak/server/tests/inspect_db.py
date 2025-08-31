import sqlite3

# conectar a la DB
conn = sqlite3.connect('test.db')
cursor = conn.cursor()

# obtener esquema de la tabla item
cursor.execute("SELECT sql FROM sqlite_master WHERE type='table' AND name='item'")
result = cursor.fetchone()

if result:
    print("Esquema actual de la tabla 'item':")
    print(result[0])
else:
    print("La tabla 'item' no existe")

# listar todas las tablas
cursor.execute("SELECT name FROM sqlite_master WHERE type='table'")
tables = cursor.fetchall()
print("\nTablas existentes:")
for table in tables:
    print(f"- {table[0]}")

conn.close()
