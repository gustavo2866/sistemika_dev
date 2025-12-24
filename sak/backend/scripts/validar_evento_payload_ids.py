import os
from sqlalchemy import create_engine, text
from dotenv import load_dotenv

load_dotenv()
DATABASE_URL = os.getenv("DATABASE_URL").replace("psycopg", "psycopg2")
engine = create_engine(DATABASE_URL)

def validar_ids(payload):
    with engine.connect() as conn:
        print("\n--- Validando IDs del payload ---")
        # Validar contacto_id
        contacto = conn.execute(text("SELECT id FROM crm_contactos WHERE id = :id"), {"id": payload["contacto_id"]}).fetchone()
        print(f"contacto_id {payload['contacto_id']}: {'OK' if contacto else 'NO EXISTE'}")
        # Validar motivo_id
        motivo = conn.execute(text("SELECT id FROM crm_motivos_evento WHERE id = :id"), {"id": payload["motivo_id"]}).fetchone()
        print(f"motivo_id {payload['motivo_id']}: {'OK' if motivo else 'NO EXISTE'}")
        # Validar oportunidad_id
        oportunidad = conn.execute(text("SELECT id FROM crm_oportunidades WHERE id = :id"), {"id": payload["oportunidad_id"]}).fetchone()
        print(f"oportunidad_id {payload['oportunidad_id']}: {'OK' if oportunidad else 'NO EXISTE'}")
        # Validar asignado_a_id
        usuario = conn.execute(text("SELECT id FROM users WHERE id = :id"), {"id": payload["asignado_a_id"]}).fetchone()
        print(f"asignado_a_id {payload['asignado_a_id']}: {'OK' if usuario else 'NO EXISTE'}")
        # Validar tipo_id
        tipo = conn.execute(text("SELECT id FROM crm_tipos_evento WHERE id = :id"), {"id": payload["tipo_id"]}).fetchone()
        print(f"tipo_id {payload['tipo_id']}: {'OK' if tipo else 'NO EXISTE'}")
        print("--- Fin de validación ---\n")

if __name__ == "__main__":
    payload = {
        "fecha_evento": "2025-12-24T09:00",
        "estado_evento": "1-pendiente",
        "asignado_a_id": 1,
        "contacto_id": 74,
        "motivo_id": 1,
        "oportunidad_id": 133,
        "tipo_evento": "evento",
        "tipo_id": 1,
        "titulo": "Alquilar depto"
    }
    validar_ids(payload)
