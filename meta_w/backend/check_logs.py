from app.db.session import engine
from sqlalchemy import text

with engine.connect() as conn:
    print("=== ÚLTIMOS LOGS DE INTEGRACIÓN ===\n")
    result = conn.execute(text("""
        SELECT 
            created_at,
            tipo,
            direccion,
            exito,
            status_code,
            error_message,
            response_payload
        FROM logs_integracion 
        ORDER BY created_at DESC 
        LIMIT 3
    """))
    
    for row in result:
        print(f"Fecha: {row[0]}")
        print(f"Tipo: {row[1]}")
        print(f"Dirección: {row[2]}")
        print(f"Éxito: {row[3]}")
        print(f"Status Code: {row[4]}")
        print(f"Error: {row[5]}")
        print(f"Response: {row[6]}")
        print("-" * 80)
