from app.db import engine
from sqlalchemy import text

def verificar_db():
    with engine.connect() as conn:
        print('=== VERIFICANDO TABLAS ===')
        result = conn.execute(text("SELECT name FROM sqlite_master WHERE type='table'"))
        tablas = [row[0] for row in result]
        for tabla in tablas:
            print(f'Tabla: {tabla}')
        
        print('\n=== PROVEEDORES ===')
        if 'proveedores' in tablas:
            result = conn.execute(text('SELECT * FROM proveedores LIMIT 5'))
            for row in result:
                print(row)
        else:
            print('Tabla proveedores no existe')
        
        print('\n=== TIPOS DE OPERACION ===')
        if 'tipos_operacion' in tablas:
            result = conn.execute(text('SELECT * FROM tipos_operacion LIMIT 5'))
            for row in result:
                print(row)
        else:
            print('Tabla tipos_operacion no existe')

if __name__ == "__main__":
    verificar_db()
