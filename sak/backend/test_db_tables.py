import psycopg

conn = psycopg.connect('postgresql://sak_user:cambia_esta_clave@localhost:5432/sak')
cur = conn.cursor()

# Listar tablas
cur.execute("SELECT tablename FROM pg_tables WHERE schemaname = 'public' ORDER BY tablename;")
tables = cur.fetchall()

print(f'\n✅ Conexión exitosa a la base de datos "sak"')
print(f'📊 Tablas encontradas: {len(tables)}\n')

if tables:
    for table in tables:
        # Contar registros en cada tabla
        cur.execute(f'SELECT COUNT(*) FROM "{table[0]}";')
        count = cur.fetchone()[0]
        print(f'  - {table[0]}: {count} registros')
else:
    print('⚠️  No se encontraron tablas en la base de datos')

conn.close()
