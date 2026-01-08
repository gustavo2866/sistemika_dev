from sqlalchemy import text
from app.db import engine

print("Comparando artículos: 'Alquiler mezcladora' (funciona) vs 'Certificacion Tecnica Avanzado' (no funciona)")

with engine.connect() as conn:
    # 1. Buscar ambos artículos específicos
    print("\n1. Buscando artículos específicos:")
    
    # Alquiler mezcladora (funciona)
    result = conn.execute(text("""
        SELECT id, nombre, tipo_articulo, sku, proveedor_id, precio, deleted_at
        FROM articulos 
        WHERE nombre ILIKE '%alquiler%mezcladora%'
        ORDER BY id
    """))
    art_mezcladora = list(result)
    print(f"   FUNCIONA - Alquiler mezcladora:")
    for art in art_mezcladora:
        print(f"     ID: {art[0]}, Nombre: '{art[1]}', Tipo: {art[2]}, SKU: {art[3]}, Proveedor: {art[4]}, Precio: {art[5]}, Deleted: {art[6]}")
    
    # Certificacion Tecnica (no funciona)
    result = conn.execute(text("""
        SELECT id, nombre, tipo_articulo, sku, proveedor_id, precio, deleted_at
        FROM articulos 
        WHERE nombre ILIKE '%certificacion%tecnica%'
        ORDER BY id
    """))
    art_certificacion = list(result)
    print(f"\n   NO FUNCIONA - Certificacion Tecnica:")
    for art in art_certificacion:
        print(f"     ID: {art[0]}, Nombre: '{art[1]}', Tipo: {art[2]}, SKU: {art[3]}, Proveedor: {art[4]}, Precio: {art[5]}, Deleted: {art[6]}")
    
    # 2. Verificar si tienen detalles de solicitud asociados
    all_art_ids = []
    if art_mezcladora:
        all_art_ids.extend([art[0] for art in art_mezcladora])
    if art_certificacion:
        all_art_ids.extend([art[0] for art in art_certificacion])
    
    if all_art_ids:
        print(f"\n2. Detalles de solicitudes que usan estos artículos:")
        art_ids_str = ','.join(str(id) for id in all_art_ids)
        result = conn.execute(text(f"""
            SELECT pd.id, pd.solicitud_id, pd.articulo_id, pd.descripcion, 
                   a.nombre as articulo_nombre, a.deleted_at as articulo_deleted
            FROM po_solicitud_detalles pd
            LEFT JOIN articulos a ON pd.articulo_id = a.id
            WHERE pd.articulo_id IN ({art_ids_str})
            ORDER BY pd.articulo_id, pd.id
        """))
        detalles = list(result)
        
        for det in detalles:
            status = "FUNCIONA" if det[2] in [art[0] for art in art_mezcladora] else "NO FUNCIONA"
            print(f"   {status} - Detalle ID: {det[0]}, Solicitud: {det[1]}, Artículo ID: {det[2]}")
            print(f"     Descripción detalle: '{det[3]}'")
            print(f"     Nombre artículo: '{det[4]}' (Deleted: {det[5] if len(det) > 5 else 'N/A'})")
            print()
    
    # 3. Buscar si hay algún problema con la relación o JOIN
    print(f"3. Verificación específica de relaciones:")
    
    if art_mezcladora:
        mezcladora_id = art_mezcladora[0][0]
        print(f"   Verificando artículo mezcladora (ID: {mezcladora_id}):")
        result = conn.execute(text(f"""
            SELECT pd.id, pd.articulo_id, pd.descripcion, 
                   a.id as art_id, a.nombre as art_nombre, a.deleted_at
            FROM po_solicitud_detalles pd
            LEFT JOIN articulos a ON pd.articulo_id = a.id
            WHERE pd.articulo_id = {mezcladora_id}
            LIMIT 1
        """))
        mezcladora_detail = list(result)
        if mezcladora_detail:
            det = mezcladora_detail[0]
            print(f"     Detalle encontrado - ID: {det[0]}")
            print(f"     Artículo en detalle: {det[1]}")
            print(f"     Artículo en JOIN: {det[3]} -> '{det[4]}' (Deleted: {det[5]})")
    
    if art_certificacion:
        cert_id = art_certificacion[0][0]
        print(f"   Verificando artículo certificación (ID: {cert_id}):")
        result = conn.execute(text(f"""
            SELECT pd.id, pd.articulo_id, pd.descripcion, 
                   a.id as art_id, a.nombre as art_nombre, a.deleted_at
            FROM po_solicitud_detalles pd
            LEFT JOIN articulos a ON pd.articulo_id = a.id
            WHERE pd.articulo_id = {cert_id}
            LIMIT 1
        """))
        cert_detail = list(result)
        if cert_detail:
            det = cert_detail[0]
            print(f"     Detalle encontrado - ID: {det[0]}")
            print(f"     Artículo en detalle: {det[1]}")
            print(f"     Artículo en JOIN: {det[3]} -> '{det[4]}' (Deleted: {det[5]})")
    
    # 4. Verificar si hay diferencias en soft delete
    print(f"\n4. Verificación de soft delete:")
    result = conn.execute(text("""
        SELECT COUNT(*) as total_articulos,
               COUNT(CASE WHEN deleted_at IS NULL THEN 1 END) as activos,
               COUNT(CASE WHEN deleted_at IS NOT NULL THEN 1 END) as eliminados
        FROM articulos
    """))
    stats = result.fetchone()
    print(f"   Total artículos: {stats[0]}, Activos: {stats[1]}, Eliminados: {stats[2]}")