import sqlite3
conn = sqlite3.connect('data/dev.db')
cursor = conn.cursor()
cursor.execute('SELECT * FROM paises')
results = cursor.fetchall()
print(results)
conn.close()
