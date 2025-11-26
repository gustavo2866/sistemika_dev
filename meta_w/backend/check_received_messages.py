from app.db.session import engine
from sqlalchemy import text

with engine.connect() as conn:
    print("\n=== MENSAJES RECIBIDOS (ENTRANTES) ===\n")
    result = conn.execute(text("""
        SELECT 
            id,
            direccion,
            tipo,
            status,
            contenido,
            created_at,
            meta_message_id
        FROM mensajes 
        WHERE direccion='in'
        ORDER BY created_at DESC 
        LIMIT 5
    """))
    
    rows = result.fetchall()
    if rows:
        for row in rows:
            print(f"ID: {row[0]}")
            print(f"Dirección: {row[1]}")
            print(f"Tipo: {row[2]}")
            print(f"Status: {row[3]}")
            print(f"Contenido: {row[4]}")
            print(f"Fecha: {row[5]}")
            print(f"Meta Message ID: {row[6]}")
            print("-" * 80)
    else:
        print("❌ No hay mensajes entrantes aún")
