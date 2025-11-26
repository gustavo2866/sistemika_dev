from app.db.session import engine
from sqlalchemy import text

with engine.connect() as conn:
    print("=== ÚLTIMO MENSAJE ENVIADO ===\n")
    result = conn.execute(text("""
        SELECT 
            m.id,
            m.direccion,
            m.tipo,
            m.status,
            m.meta_message_id,
            m.created_at,
            m.sent_at,
            c.nombre as contacto,
            c.telefono
        FROM mensajes m
        JOIN contactos c ON m.contacto_id = c.id
        ORDER BY m.created_at DESC 
        LIMIT 1
    """))
    
    row = result.fetchone()
    print(f"ID Mensaje: {row[0]}")
    print(f"Dirección: {row[1]}")
    print(f"Tipo: {row[2]}")
    print(f"Status: {row[3]}")
    print(f"Meta Message ID: {row[4]}")
    print(f"Creado: {row[5]}")
    print(f"Enviado: {row[6]}")
    print(f"Contacto: {row[7]}")
    print(f"Teléfono: {row[8]}")
    
    print("\n=== ÚLTIMO LOG DE INTEGRACIÓN ===\n")
    result = conn.execute(text("""
        SELECT 
            scope,
            intent,
            status_code,
            resultado,
            created_at,
            response_payload
        FROM logs_integracion 
        ORDER BY created_at DESC 
        LIMIT 1
    """))
    
    row = result.fetchone()
    print(f"Scope: {row[0]}")
    print(f"Intent: {row[1]}")
    print(f"Status Code: {row[2]}")
    print(f"Resultado: {row[3]}")
    print(f"Fecha: {row[4]}")
    print(f"Response de Meta: {row[5]}")
