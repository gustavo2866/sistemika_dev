import sqlite3
conn = sqlite3.connect('data/dev.db')
cursor = conn.cursor()
try:
    cursor.execute("INSERT INTO paises (name) VALUES ('Argentina')")
    cursor.execute("INSERT INTO paises (name) VALUES ('Brasil')")
    conn.commit()
    print("Países insertados")
except Exception as e:
    print(f"Error: {e}")
cursor.execute('SELECT * FROM paises')
results = cursor.fetchall()
print(results)
conn.close()
