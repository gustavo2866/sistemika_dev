from sqlalchemy import text
from app.db import engine

with engine.connect() as conn:
    print('Verificando los primeros 100 artículos de TODOS los tipos:')
    print()
    
    result = conn.execute(text('''
        SELECT ROW_NUMBER() OVER (ORDER BY nombre ASC) as posicion, 
               id, nombre, tipo_articulo
        FROM articulos 
        ORDER BY nombre ASC
        LIMIT 120
    '''))
    
    articulos_problematicos = [156, 158, 188]
    servicios_count = 0
    
    for row in result:
        pos, art_id, nombre, tipo = row
        if tipo == 'Servicio':
            servicios_count += 1
        
        if art_id in articulos_problematicos:
            status = '✅ FUNCIONA' if art_id == 156 else '❌ NO FUNCIONA'
            within_limit = '(DENTRO)' if pos <= 100 else '(FUERA)'
            print(f'Pos {pos}: ID {art_id} "{nombre}" [{tipo}] {status} {within_limit}')
    
    print(f'Total artículos tipo Servicio en primeros 120: {servicios_count}')
    
    print('\nVerificando artículos alrededor de la posición 100:')
    result = conn.execute(text('''
        SELECT ROW_NUMBER() OVER (ORDER BY nombre ASC) as posicion, 
               id, nombre, tipo_articulo
        FROM articulos 
        ORDER BY nombre ASC
        OFFSET 95 LIMIT 10
    '''))
    
    for row in result:
        pos, art_id, nombre, tipo = row
        pos_real = pos + 95
        print(f'  {pos_real}: ID {art_id} "{nombre}" [{tipo}]')