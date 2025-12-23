import os
import random
from sqlalchemy import create_engine, text
from dotenv import load_dotenv

# Cargar variables de entorno
load_dotenv()
DATABASE_URL = os.getenv("DATABASE_URL")

# Tipos válidos
TIPOS_VALIDOS = ["llamada", "visita", "tarea", "evento"]

engine = create_engine(DATABASE_URL)

with engine.connect() as conn:
    # 1. Actualizar eventos con tipo no válido
    update_sql = text(f'''
        UPDATE crm_evento
        SET tipo_evento = :nuevo_tipo
        WHERE tipo_evento NOT IN :tipos_validos
    ''')
    # Buscar ids de eventos con tipo no válido
    select_sql = text('''
        SELECT id FROM crm_evento WHERE tipo_evento NOT IN :tipos_validos
    ''')
    result = conn.execute(select_sql, {"tipos_validos": tuple(TIPOS_VALIDOS)})
    ids = [row[0] for row in result]
    for eid in ids:
        nuevo_tipo = random.choice(TIPOS_VALIDOS)
        conn.execute(text('''UPDATE crm_evento SET tipo_evento = :nuevo_tipo WHERE id = :eid'''), {"nuevo_tipo": nuevo_tipo, "eid": eid})
    print(f"Actualizados {len(ids)} eventos con tipo no válido.")

    # 2. Eliminar tipos de evento no válidos de la tabla de tipos
    delete_sql = text('''
        DELETE FROM crm_tipo_evento WHERE nombre NOT IN :tipos_validos
    ''')
    conn.execute(delete_sql, {"tipos_validos": tuple(TIPOS_VALIDOS)})
    print("Eliminados tipos de evento no válidos de crm_tipo_evento.")
