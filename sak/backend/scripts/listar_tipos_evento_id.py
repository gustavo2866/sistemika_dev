import os
from sqlalchemy import create_engine, text
from dotenv import load_dotenv

# Cargar variables de entorno
load_dotenv()
DATABASE_URL = os.getenv("DATABASE_URL").replace("psycopg", "psycopg2")

engine = create_engine(DATABASE_URL)

with engine.connect() as conn:
    result = conn.execute(text("SELECT id, codigo, nombre FROM crm_tipos_evento ORDER BY id"))
    print("\nID  | Código     | Nombre\n----|------------|------------------")
    for row in result:
        print(f"{row.id:<3} | {row.codigo:<10} | {row.nombre}")
