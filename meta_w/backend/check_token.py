from app.db.session import engine
from sqlalchemy import text

with engine.connect() as conn:
    result = conn.execute(text("SELECT id, nombre, meta_access_token FROM empresas WHERE id = '692d787d-06c4-432e-a94e-cf0686e593eb'"))
    row = result.fetchone()
    print(f"ID: {row[0]}")
    print(f"Nombre: {row[1]}")
    print(f"Token completo: {row[2]}")
    print(f"Longitud del token: {len(row[2]) if row[2] else 0}")
