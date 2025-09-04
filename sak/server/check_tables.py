import sqlite3

# conectar a la DB
conn = sqlite3.connect('test.db')
cursor = conn.cursor()

# listar todas las tablas
cursor.execute("SELECT name FROM sqlite_master WHERE type='table'")
tables = cursor.fetchall()
print("Tablas existentes:")
for table in tables:
    print(f"- {table[0]}")

conn.close()
