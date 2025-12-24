import os
from sqlalchemy import create_engine, text
from dotenv import load_dotenv

load_dotenv()
DATABASE_URL = os.getenv("DATABASE_URL").replace("psycopg", "psycopg2")
engine = create_engine(DATABASE_URL)

def check_evento_insert():
    # Simula los datos del evento
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
    print("\n--- Validando datos para alta de evento ---")
    with engine.connect() as conn:
        # 1. Verifica tipo_evento y tipo_id
        tipo_evento = payload["tipo_evento"]
        tipo_id = payload["tipo_id"]
        tipo = conn.execute(text("SELECT id, codigo, nombre FROM crm_tipos_evento WHERE id = :id OR codigo = :codigo"), {"id": tipo_id, "codigo": tipo_evento}).fetchall()
        if not tipo:
            print(f"ERROR: No existe tipo_evento con id={tipo_id} o codigo='{tipo_evento}'")
        else:
            print(f"Tipo de evento encontrado: {[dict(row._mapping) for row in tipo]}")
        # 2. Verifica asignado_a_id
        asignado = conn.execute(text("SELECT id FROM usuarios WHERE id = :id"), {"id": payload["asignado_a_id"]}).fetchone()
        if not asignado:
            print(f"ERROR: No existe usuario con id={payload['asignado_a_id']}")
        else:
            print(f"Usuario asignado existe: id={payload['asignado_a_id']}")
        # 3. Verifica contacto_id
        contacto = conn.execute(text("SELECT id FROM contactos WHERE id = :id"), {"id": payload["contacto_id"]}).fetchone()
        if not contacto:
            print(f"ERROR: No existe contacto con id={payload['contacto_id']}")
        else:
            print(f"Contacto existe: id={payload['contacto_id']}")
        # 4. Verifica motivo_id
        motivo = conn.execute(text("SELECT id FROM motivos WHERE id = :id"), {"id": payload["motivo_id"]}).fetchone()
        if not motivo:
            print(f"ERROR: No existe motivo con id={payload['motivo_id']}")
        else:
            print(f"Motivo existe: id={payload['motivo_id']}")
        # 5. Verifica oportunidad_id
        oportunidad = conn.execute(text("SELECT id FROM oportunidades WHERE id = :id"), {"id": payload["oportunidad_id"]}).fetchone()
        if not oportunidad:
            print(f"ERROR: No existe oportunidad con id={payload['oportunidad_id']}")
        else:
            print(f"Oportunidad existe: id={payload['oportunidad_id']}")
        print("\n--- Validación terminada ---")

if __name__ == "__main__":
    check_evento_insert()
