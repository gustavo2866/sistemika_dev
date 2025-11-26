from app.db.session import engine
from sqlalchemy import text

with engine.connect() as conn:
    result = conn.execute(text('SELECT COUNT(*) FROM empresas'))
    print(f'Empresas: {result.scalar()}')
    
    result = conn.execute(text('SELECT COUNT(*) FROM celulares'))
    print(f'Celulares: {result.scalar()}')
    
    result = conn.execute(text('SELECT COUNT(*) FROM contactos'))
    print(f'Contactos: {result.scalar()}')
