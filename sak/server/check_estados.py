import sqlite3

conn = sqlite3.connect('invoice_system.db')
cursor = conn.cursor()

# Verificar estados en facturas
try:
    cursor.execute('SELECT estado, COUNT(*) FROM facturas GROUP BY estado')
    estados = cursor.fetchall()
    print('Estados en la base de datos:')
    for estado, count in estados:
        print(f'  - {estado}: {count}')
except Exception as e:
    print(f'Error consultando estados: {e}')

# Verificar total de facturas
cursor.execute('SELECT COUNT(*) FROM facturas')
total = cursor.fetchone()[0]
print(f'Total facturas: {total}')

conn.close()
