import sqlite3
conn = sqlite3.connect('data/dev.db')
cursor = conn.cursor()
# Obtener los IDs de los países
cursor.execute("SELECT id FROM paises WHERE name IN ('Argentina', 'Brasil') ORDER BY id ASC")
pais_ids = [row[0] for row in cursor.fetchall()]
print(f"País IDs: {pais_ids}")
# Obtener los usuarios
cursor.execute("SELECT id FROM users ORDER BY id ASC")
usuarios = cursor.fetchall()
print(f"Usuarios: {usuarios}")
# Asignar alternadamente los países a los usuarios
for idx, usuario in enumerate(usuarios):
    pais_id = pais_ids[idx % len(pais_ids)]
    cursor.execute("UPDATE users SET pais_id = ? WHERE id = ?", (pais_id, usuario[0]))
    print(f"Asignado país {pais_id} a usuario {usuario[0]}")
conn.commit()
conn.close()
print("Asignación completada")
