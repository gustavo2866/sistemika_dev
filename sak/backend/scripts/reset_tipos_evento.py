
import os
import random
from datetime import datetime
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
    # 1. Buscar ids duplicados de 'llamado' que no sean id=1
    ids_duplicados = [row[0] for row in conn.execute(text("SELECT id FROM crm_tipos_evento WHERE codigo = 'llamado' AND id != 1"))]
    if ids_duplicados:
        # Reasignar eventos con tipo_id duplicado a id=1
        for dup_id in ids_duplicados:
            conn.execute(text("UPDATE crm_eventos SET tipo_id = 1 WHERE tipo_id = :dup_id"), {"dup_id": dup_id})
        print(f"Reasignados eventos de tipo_id duplicados {ids_duplicados} a id=1.")
        # Eliminar duplicados
        conn.execute(text("DELETE FROM crm_tipos_evento WHERE codigo = 'llamado' AND id != 1"))
        print("Eliminados duplicados de 'llamado' que no sean id=1.")
    else:
        print("No hay duplicados de 'llamado' que no sean id=1.")

    # 2. Forzar que el id=1 sea 'llamado'
    conn.execute(text("UPDATE crm_tipos_evento SET codigo = 'llamado', nombre = 'Llamado', activo = true WHERE id = 1"))
    print("El registro con id=1 ahora es 'llamado'.")

    # 3. Asignar tipo_id=1 a todos los eventos
    conn.execute(text("UPDATE crm_eventos SET tipo_id = 1"))
    print("Todos los registros de crm_eventos ahora tienen tipo_id=1.")

    # 4. Eliminar tipos no válidos y dejar solo los válidos (excepto id=1)
    codigos_validos = tuple([t["codigo"] for t in TIPOS_VALIDOS])
    delete_sql = text("DELETE FROM crm_tipos_evento WHERE codigo NOT IN :codigos AND id != 1")
    conn.execute(delete_sql, {"codigos": codigos_validos})
    print(f"Eliminados tipos de evento no válidos excepto id=1. Solo quedan: {codigos_validos}")

    # 5. Insertar los tipos válidos que falten (excepto 'llamado')
    select_sql = text("SELECT codigo, id FROM crm_tipos_evento")
    existentes = {row[0]: row[1] for row in conn.execute(select_sql)}
    for tipo in TIPOS_VALIDOS:
        if tipo["codigo"] not in existentes:
            now = datetime.utcnow()
            insert_sql = text("INSERT INTO crm_tipos_evento (codigo, nombre, activo, created_at, updated_at, version) VALUES (:codigo, :nombre, true, :created_at, :updated_at, :version)")
            params = {"codigo": tipo["codigo"], "nombre": tipo["nombre"], "created_at": now, "updated_at": now, "version": 1}
            conn.execute(insert_sql, params)
            print(f"Insertado tipo: {tipo}")
    # Actualizar ids después de posibles inserts
    existentes = {row[0]: row[1] for row in conn.execute(select_sql)}

    # 6. Asignar aleatoriamente tipo_id válido a cada evento
    eventos = conn.execute(text("SELECT id FROM crm_eventos")).fetchall()
    tipo_ids = list(existentes.values())
    for evento in eventos:
        tipo_id = random.choice(tipo_ids)
        conn.execute(text("UPDATE crm_eventos SET tipo_id = :tipo_id WHERE id = :evento_id"), {"tipo_id": tipo_id, "evento_id": evento[0]})
    print("Asignados tipos de evento aleatorios a los eventos.")
