from app.db.session import engine
from sqlalchemy import text

with engine.connect() as conn:
    print("=== EVENTOS DE WEBHOOK RECIBIDOS ===\n")
    result = conn.execute(text("""
        SELECT 
            id,
            empresa_id,
            tipo_evento,
            meta_entry_id,
            procesado,
            created_at,
            raw_payload
        FROM webhook_eventos 
        ORDER BY created_at DESC 
        LIMIT 3
    """))
    
    for row in result:
        print(f"ID: {row[0]}")
        print(f"Empresa: {row[1]}")
        print(f"Tipo: {row[2]}")
        print(f"Entry ID: {row[3]}")
        print(f"Procesado: {row[4]}")
        print(f"Fecha: {row[5]}")
        print(f"Payload: {row[6]}")
        print("-" * 80)
