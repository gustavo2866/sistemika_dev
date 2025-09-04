import sqlite3
from datetime import datetime
conn = sqlite3.connect('data/dev.db')
cursor = conn.cursor()
now = datetime.now().isoformat()
try:
    cursor.execute("INSERT INTO paises (name, created_at, updated_at, version) VALUES (?, ?, ?, ?)", ('Argentina', now, now, 1))
    cursor.execute("INSERT INTO paises (name, created_at, updated_at, version) VALUES (?, ?, ?, ?)", ('Brasil', now, now, 1))
    conn.commit()
    print("Países insertados")
except Exception as e:
    print(f"Error: {e}")
cursor.execute('SELECT * FROM paises')
results = cursor.fetchall()
print(results)
conn.close()
