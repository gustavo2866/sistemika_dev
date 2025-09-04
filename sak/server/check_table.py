import sqlite3
conn = sqlite3.connect('data/dev.db')
cursor = conn.cursor()
cursor.execute('SELECT name FROM sqlite_master WHERE type="table" AND name="paises"')
result = cursor.fetchone()
print(result)
conn.close()
