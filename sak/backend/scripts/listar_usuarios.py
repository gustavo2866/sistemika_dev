import os
from sqlalchemy import create_engine, text
from dotenv import load_dotenv

# Cargar variables de entorno
load_dotenv()
DATABASE_URL = os.getenv("DATABASE_URL").replace("psycopg", "psycopg2")

engine = create_engine(DATABASE_URL)

with engine.connect() as conn:
    result = conn.execute(text("SELECT id, nombre, email FROM users ORDER BY nombre"))
    print("Usuarios en la base de datos:")
    columns = result.keys()
    for row in result:
        print({col: row[i] for i, col in enumerate(columns)})
