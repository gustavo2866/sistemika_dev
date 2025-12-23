import os
from sqlalchemy import create_engine, text
from dotenv import load_dotenv

# Cargar variables de entorno
load_dotenv()
DATABASE_URL = os.getenv("DATABASE_URL").replace("psycopg", "psycopg2")

TIPOS_VALIDOS = [
    {"codigo": "llamado", "nombre": "Llamado"},
    {"codigo": "visita", "nombre": "Visita"},
    {"codigo": "tarea", "nombre": "Tarea"},
    {"codigo": "evento", "nombre": "Evento"},
]

engine = create_engine(DATABASE_URL)

with engine.begin() as conn:
    # Eliminar los tipos no válidos
    codigos_validos = tuple([t["codigo"] for t in TIPOS_VALIDOS])
    delete_sql = text("DELETE FROM crm_tipos_evento WHERE codigo NOT IN :codigos")
    conn.execute(delete_sql, {"codigos": codigos_validos})
    print(f"Eliminados tipos de evento no válidos. Solo quedan: {codigos_validos}")

    # Insertar los tipos válidos que falten
    select_sql = text("SELECT codigo FROM crm_tipos_evento")
    existentes = {row[0] for row in conn.execute(select_sql)}
    for tipo in TIPOS_VALIDOS:
        if tipo["codigo"] not in existentes:
            insert_sql = text("INSERT INTO crm_tipos_evento (codigo, nombre, activo) VALUES (:codigo, :nombre, true)")
            conn.execute(insert_sql, tipo)
            print(f"Insertado tipo: {tipo}")
    print("Actualización de tipos de evento completada.")
