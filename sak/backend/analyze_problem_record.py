from app.db import get_session
from sqlalchemy import text

def analyze_problematic_record():
    session = next(get_session())
    
    # Verificar el registro con ID=0
    result = session.execute(text("""
        SELECT 
            d.id, d.solicitud_id, d.articulo_id, d.descripcion, 
            d.cantidad, d.precio, d.importe,
            s.titulo, s.estado
        FROM po_solicitud_detalles d
        JOIN po_solicitudes s ON d.solicitud_id = s.id
        WHERE d.id = 0
    """))
    
    record = result.fetchone()
    if record:
        print("Registro problemático con ID=0:")
        print(f"  Detalle ID: {record[0]}")
        print(f"  Solicitud ID: {record[1]} ('{record[7]}', estado: {record[8]})")
        print(f"  Artículo ID: {record[2]}")
        print(f"  Descripción: '{record[3]}'")
        print(f"  Cantidad: {record[4]}, Precio: {record[5]}, Importe: {record[6]}")
    
    # Verificar si hay otros detalles para la misma solicitud
    result = session.execute(text("""
        SELECT id, articulo_id, descripcion, cantidad, precio, importe
        FROM po_solicitud_detalles 
        WHERE solicitud_id = :solicitud_id AND id != 0
        ORDER BY id
    """), {"solicitud_id": record[1]})
    
    other_details = result.fetchall()
    print(f"\nOtros detalles de la misma solicitud ({len(other_details)} encontrados):")
    for detail in other_details:
        print(f"  ID: {detail[0]}, Artículo: {detail[1]}, Descripción: '{detail[2]}', Cantidad: {detail[3]}")

if __name__ == "__main__":
    analyze_problematic_record()