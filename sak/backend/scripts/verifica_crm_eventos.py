import os
from sqlalchemy import create_engine, inspect
from dotenv import load_dotenv

# Cargar variables de entorno
load_dotenv()

# Forzar uso de psycopg2 si es necesario
DATABASE_URL = os.getenv("DATABASE_URL").replace("psycopg", "psycopg2")

engine = create_engine(DATABASE_URL)
inspector = inspect(engine)

table = "crm_eventos"

if table not in inspector.get_table_names():
    print(f"La tabla {table} NO existe en la base de datos.")
else:
    print(f"La tabla {table} existe.\n")
    columns = inspector.get_columns(table)
    print("Columnas en la base de datos:")
    for col in columns:
        print(f"- {col['name']} ({col['type']})")

    fks = inspector.get_foreign_keys(table)
    if fks:
        print("\nForeign Keys:")
        for fk in fks:
            print(f"- {fk['constrained_columns']} -> {fk['referred_table']}({fk['referred_columns']})")
    else:
        print("\nNo hay claves foráneas definidas.")
