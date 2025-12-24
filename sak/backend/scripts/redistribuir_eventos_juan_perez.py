import os
import random
from datetime import datetime, timedelta
from sqlalchemy import create_engine, text
from dotenv import load_dotenv

# Cargar variables de entorno
load_dotenv()
DATABASE_URL = os.getenv("DATABASE_URL").replace("psycopg", "psycopg2")

engine = create_engine(DATABASE_URL)

with engine.begin() as conn:
    juan_id = 2  # id de Juan Pérez

    # Obtener ids de otros usuarios
    other_users = [row[0] for row in conn.execute(text("SELECT id FROM users WHERE id != :juan_id"), {"juan_id": juan_id})]
    if not other_users:
        print("No hay otros usuarios para distribuir los eventos.")
        exit(1)

    # Obtener eventos de Juan Pérez
    eventos = conn.execute(text("SELECT id FROM crm_eventos WHERE asignado_a_id = :juan_id"), {"juan_id": juan_id}).fetchall()
    if not eventos:
        print("No hay eventos asignados a Juan Pérez.")
        exit(0)

    eventos_ids = [row[0] for row in eventos]
    random.shuffle(eventos_ids)

    # Distribuir eventos proporcionalmente
    n_users = len(other_users)
    for idx, evento_id in enumerate(eventos_ids):
        nuevo_usuario = other_users[idx % n_users]
        # 50% vencidos, 50% futuros
        if idx % 2 == 0:
            # Evento vencido: fecha entre 30 y 1 días atrás
            dias = random.randint(1, 30)
            fecha = datetime.now() - timedelta(days=dias, hours=random.randint(0, 23), minutes=random.randint(0, 59))
        else:
            # Evento futuro: fecha entre 1 y 30 días adelante
            dias = random.randint(1, 30)
            fecha = datetime.now() + timedelta(days=dias, hours=random.randint(0, 23), minutes=random.randint(0, 59))
        conn.execute(text("UPDATE crm_eventos SET asignado_a_id = :nuevo_usuario, fecha_evento = :fecha WHERE id = :evento_id"), {"nuevo_usuario": nuevo_usuario, "fecha": fecha, "evento_id": evento_id})
    print(f"Redistribuidos {len(eventos_ids)} eventos de Juan Pérez entre {n_users} usuarios, con fechas mezcladas.")
