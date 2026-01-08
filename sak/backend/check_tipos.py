from sqlalchemy import text
from app.db import engine

with engine.connect() as conn:
    print('Verificando posición de artículos tipo Servicio en orden alfabético:')
    print()
    
    result = conn.execute(text('''
        SELECT ROW_NUMBER() OVER (ORDER BY nombre ASC) as posicion, 
               id, nombre
        FROM articulos 
        WHERE tipo_articulo = 'Servicio'
        ORDER BY nombre ASC
    '''))
    
    articulos_problematicos = [156, 158, 188]
    
    for row in result:
        pos, art_id, nombre = row
        if art_id in articulos_problematicos:
            status = '✅ FUNCIONA' if art_id == 156 else '❌ NO FUNCIONA'
            print(f'Posición {pos}: ID {art_id} "{nombre}" {status}')
        if pos > 110:  # Solo mostrar hasta posición 110 para ver el contexto
            break
    
    print()
    print('Total artículos tipo Servicio:')
    result = conn.execute(text("SELECT COUNT(*) FROM articulos WHERE tipo_articulo = 'Servicio'"))
    total = result.fetchone()[0]
    print(f'  {total} artículos')
    
    print()
    print('Primeros 10 artículos tipo Servicio (para ver límite):')
    result = conn.execute(text('''
        SELECT ROW_NUMBER() OVER (ORDER BY nombre ASC) as posicion, 
               id, nombre
        FROM articulos 
        WHERE tipo_articulo = 'Servicio'
        ORDER BY nombre ASC
        LIMIT 10
    '''))
    for row in result:
        pos, art_id, nombre = row
        print(f'  {pos}: ID {art_id} "{nombre}"')