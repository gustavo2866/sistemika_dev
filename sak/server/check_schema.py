import sqlite3
conn = sqlite3.connect('data/dev.db')
cursor = conn.cursor()
cursor.execute('PRAGMA table_info(paises)')
results = cursor.fetchall()
print(results)
conn.close()
