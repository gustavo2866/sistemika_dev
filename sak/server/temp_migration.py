import sqlite3
print('🔄 Iniciando migración directa...')
conn = sqlite3.connect('data/dev.db', timeout=30)
cursor = conn.cursor()

# Verificar datos
cursor.execute('SELECT COUNT(*) FROM items')
count_items = cursor.fetchone()[0]
print(f'📦 items: {count_items} registros')

# Limpiar item
cursor.execute('DELETE FROM item')
print('🧹 Tabla item limpiada')

# Copiar datos
cursor.execute('''
    INSERT INTO item (id, created_at, updated_at, deleted_at, version, name, description, user_id, price, category, stock)
    SELECT id, created_at, updated_at, deleted_at, version, name, description, user_id, price, category, stock
    FROM items
    ORDER BY id
''')
print('📋 Datos copiados')

# Verificar
cursor.execute('SELECT COUNT(*) FROM item')
count_item = cursor.fetchone()[0]
print(f'✅ item: {count_item} registros')

if count_item == count_items:
    cursor.execute('DROP TABLE items')
    print('✅ Tabla items eliminada')
    conn.commit()
    print('🎉 Migración completada!')
else:
    print('❌ Error en la migración')
    conn.rollback()

conn.close()
