import os
from sqlalchemy import create_engine, inspect
from dotenv import load_dotenv

# Cargar variables de entorno
load_dotenv()
DATABASE_URL = os.getenv("DATABASE_URL").replace("psycopg", "psycopg2")

engine = create_engine(DATABASE_URL)
inspector = inspect(engine)

tables = inspector.get_table_names()
print("Tablas en la base de datos:")
for t in tables:
    print(f"- {t}")
