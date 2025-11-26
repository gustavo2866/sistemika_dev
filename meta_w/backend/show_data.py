from app.db.session import engine
from sqlalchemy import text

with engine.connect() as conn:
    print("=== EMPRESAS ===")
    result = conn.execute(text('SELECT id, nombre, meta_access_token FROM empresas'))
    for row in result:
        print(f"ID: {row[0]}")
        print(f"Nombre: {row[1]}")
        print(f"Token: {row[2][:20] if row[2] else 'None'}...")
        print()
    
    print("=== CELULARES ===")
    result = conn.execute(text('SELECT id, empresa_id, phone_number, meta_phone_number_id FROM celulares'))
    for row in result:
        print(f"ID: {row[0]}")
        print(f"Empresa ID: {row[1]}")
        print(f"Número: {row[2]}")
        print(f"Meta Phone ID: {row[3]}")
        print()
    
    print("=== CONTACTOS ===")
    result = conn.execute(text('SELECT id, empresa_id, nombre, telefono FROM contactos'))
    for row in result:
        print(f"ID: {row[0]}")
        print(f"Empresa ID: {row[1]}")
        print(f"Nombre: {row[2]}")
        print(f"Teléfono: {row[3]}")
        print()
