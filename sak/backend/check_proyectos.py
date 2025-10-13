from sqlalchemy import create_engine, inspect, text
import os
from dotenv import load_dotenv

load_dotenv()
engine = create_engine(os.getenv('DATABASE_URL'))
inspector = inspect(engine)
tables = inspector.get_table_names()

print('\nTablas en produccion (Neon):')
print('='*50)
for t in sorted(tables):
    print(f'  - {t}')

print('='*50)
print(f'\nProyectos existe: {"proyectos" in tables}')

if 'proyectos' in tables:
    with engine.connect() as conn:
        count = conn.execute(text('SELECT COUNT(*) FROM proyectos')).scalar()
        print(f'Registros en proyectos: {count}')
