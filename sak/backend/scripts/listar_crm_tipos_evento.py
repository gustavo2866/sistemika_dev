import os
from sqlalchemy import create_engine, text
from dotenv import load_dotenv

# Cargar variables de entorno
load_dotenv()
DATABASE_URL = os.getenv("DATABASE_URL").replace("psycopg", "psycopg2")

engine = create_engine(DATABASE_URL)

with engine.connect() as conn:
    result = conn.execute(text("SELECT * FROM crm_tipos_evento"))
    rows = result.fetchall()
    if not rows:
        print("No hay registros en crm_tipos_evento.")
    else:
        print("Valores actuales en crm_tipos_evento:")
        columns = result.keys()
        for row in rows:
            print({col: row[i] for i, col in enumerate(columns)})
