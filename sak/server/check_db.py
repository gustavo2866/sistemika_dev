import sqlite3

conn = sqlite3.connect('test.db')
cursor = conn.cursor()

# Verificar tablas existentes
cursor.execute("SELECT name FROM sqlite_master WHERE type='table'")
tables = cursor.fetchall()
print("Tablas existentes:", [t[0] for t in tables])

# Verificar estructura de cada tabla
for table in tables:
    table_name = table[0]
    cursor.execute(f"PRAGMA table_info({table_name})")
    columns = cursor.fetchall()
    print(f"\nTabla {table_name}:")
    for col in columns:
        print(f"  - {col[1]} {col[2]}")

conn.close()
