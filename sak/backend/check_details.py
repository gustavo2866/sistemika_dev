from sqlalchemy import text
from app.db import engine

with engine.connect() as conn:
    print("Verificando detalles de solicitudes:")
    result = conn.execute(text("""
        SELECT pd.id, pd.solicitud_id, pd.articulo_id, pd.descripcion, a.nombre 
        FROM po_solicitud_detalles pd 
        LEFT JOIN articulos a ON pd.articulo_id = a.id 
        ORDER BY pd.id
    """))
    
    for r in result:
        art_name = r[4] if r[4] else "NULL"
        print(f"Detalle {r[0]}: Artículo {r[2]} -> '{art_name}'")
        print(f"  Descripción: '{r[3]}'")
        print()