from sqlalchemy import text
from app.db import engine

print("Verificando conexión a Neon...")
try:
    with engine.connect() as conn:
        # Verificar tablas PO
        result = conn.execute(text("SELECT table_name FROM information_schema.tables WHERE table_name LIKE 'po_%' ORDER BY table_name"))
        po_tables = [row[0] for row in result]
        print(f'Tablas PO encontradas en Neon: {po_tables}')
        
        # Verificar la versión actual de alembic
        try:
            result2 = conn.execute(text("SELECT version_num FROM alembic_version"))
            version = result2.fetchone()
            if version:
                print(f'Versión actual de Alembic en Neon: {version[0]}')
            else:
                print('No hay versión de Alembic registrada')
        except Exception as e:
            print(f'Error al verificar versión de Alembic: {e}')
            
        # Verificar URL de conexión
        print(f'URL de conexión: {str(engine.url).replace(engine.url.password, "***") if engine.url.password else engine.url}')
        
except Exception as e:
    print(f'Error de conexión: {e}')